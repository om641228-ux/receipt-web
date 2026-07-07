require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const { supabase } = require('./supabase');
const { uploadReceiptPhoto, deleteReceiptPhoto } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer: храним файлы в памяти (buffer)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

// ============================================================
// HELPERS
// ============================================================

function mapReceipt(row) {
  if (!row) return null;
  return {
    ...row,
    image_url: row.photo_url || row.image_url || null,
    raw_text: row.raw_text || row.recognized_text || null,
    receipt_date: row.receipt_date || row.purchase_date || null,
    store_name_ru: row.store_name_ru || row.store_name || null,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || [])
  };
}

function mapReceipts(rows) {
  return (rows || []).map(mapReceipt);
}

function checkToken(req, res, next) {
  const token = req.query.token || req.body.token || req.headers['x-token'];
  if (!token) return res.status(401).json({ success: false, error: 'No token' });
  req.token = token;
  next();
}

// ============================================================
// HEALTH
// ============================================================
app.get('/health', async (req, res) => {
  try {
    const { error } = await supabase.from('receipts').select('count', { count: 'exact', head: true });
    res.json({ 
      status: 'ok', 
      supabase_connected: !error,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================
// AUTH
// ============================================================

const USERS = {
  'admin': { id: 'admin', name: 'Администратор', role: 'admin', password: 'admin' },
  'user1': { id: 'user1', name: 'Пользователь 1', role: 'user', password: 'user1' },
  'user2': { id: 'user2', name: 'Пользователь 2', role: 'user', password: 'user2' },
  'user3': { id: 'user3', name: 'Пользователь 3', role: 'user', password: 'user3' },
  'user4': { id: 'user4', name: 'Пользователь 4', role: 'user', password: 'user4' },
  'user5': { id: 'user5', name: 'Пользователь 5', role: 'user', password: 'user5' },
  'user6': { id: 'user6', name: 'Пользователь 6', role: 'user', password: 'user6' },
  'user7': { id: 'user7', name: 'Пользователь 7', role: 'user', password: 'user7' },
  'user8': { id: 'user8', name: 'Пользователь 8', role: 'user', password: 'user8' },
  'user9': { id: 'user9', name: 'Пользователь 9', role: 'user', password: 'user9' },
  'user10': { id: 'user10', name: 'Пользователь 10', role: 'user', password: 'user10' },
};

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const user = Object.values(USERS).find(u => u.password === password);
  if (user) {
    const token = `token_${user.id}_${Date.now()}`;
    res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
  } else {
    res.status(401).json({ success: false, error: 'Неверный пароль' });
  }
});

app.get('/api/me', checkToken, (req, res) => {
  res.json({ success: true, user: { id: 'admin', name: 'Администратор', role: 'admin' } });
});

// ============================================================
// UPLOAD & RECOGNIZE
// ============================================================
app.post('/api/upload-receipt', upload.single('image'), async (req, res) => {
  try {
    let photoUrl = null;
    let photoPath = null;

    if (req.file) {
      const result = await uploadReceiptPhoto(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      photoUrl = result.url;
      photoPath = result.path;
    }

    const body = req.body;
    let items = [];
    try {
      items = body.items ? (typeof body.items === 'string' ? JSON.parse(body.items) : body.items) : [];
    } catch (e) { items = []; }

    const receiptData = {
      store_name: body.store_name || null,
      store_name_ru: body.store_name_ru || body.store_name || null,
      total_amount: body.total_amount ? parseFloat(body.total_amount) : null,
      currency: body.currency || 'EUR',
      purchase_date: body.purchase_date || body.receipt_date || null,
      receipt_date: body.receipt_date || body.purchase_date || null,
      receipt_time: body.receipt_time || null,
      items: items,
      recognized_text: body.recognized_text || body.raw_text || null,
      raw_text: body.raw_text || body.recognized_text || null,
      photo_url: photoUrl,
      photo_path: photoPath,
      image_url: photoUrl,
      document_type: body.docType || body.document_type || 'receipt',
      object: body.object || 'other',
      recognition_method: body.recognition_method || body.model || null,
      owner_id: body.owner_id || null,
      owner_name: body.owner_name || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('receipts')
      .insert([receiptData])
      .select();

    if (error) {
      if (photoPath) await deleteReceiptPhoto(photoPath);
      throw error;
    }

    res.json({ success: true, data: mapReceipt(data[0]) });
  } catch (err) {
    console.error('POST /api/upload-receipt error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// RECEIPTS CRUD
// ============================================================

app.get('/api/receipts', async (req, res) => {
  try {
    const { owner_id, limit = 100, offset = 0 } = req.query;
    let query = supabase
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (owner_id) query = query.eq('owner_id', owner_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, receipts: mapReceipts(data) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/receipts/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, receipt: mapReceipt(data) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/receipts/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: old } = await supabase.from('receipts').select('photo_path').eq('id', id).single();

    let photoUrl = req.body.photo_url || req.body.image_url || null;
    let photoPath = req.body.photo_path || null;

    if (req.file) {
      const result = await uploadReceiptPhoto(req.file.buffer, req.file.originalname, req.file.mimetype);
      photoUrl = result.url;
      photoPath = result.path;
      if (old?.photo_path) await deleteReceiptPhoto(old.photo_path);
    }

    let items = [];
    try { items = req.body.items ? (typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items) : []; } catch (e) {}

    const updateData = {
      store_name: req.body.store_name || null,
      store_name_ru: req.body.store_name_ru || req.body.store_name || null,
      total_amount: req.body.total_amount ? parseFloat(req.body.total_amount) : null,
      currency: req.body.currency || 'EUR',
      purchase_date: req.body.purchase_date || req.body.receipt_date || null,
      receipt_date: req.body.receipt_date || req.body.purchase_date || null,
      receipt_time: req.body.receipt_time || null,
      items: items,
      recognized_text: req.body.recognized_text || req.body.raw_text || null,
      raw_text: req.body.raw_text || req.body.recognized_text || null,
      photo_url: photoUrl,
      photo_path: photoPath,
      image_url: photoUrl,
      document_type: req.body.docType || req.body.document_type || 'receipt',
      object: req.body.object || 'other',
      owner_id: req.body.owner_id || null,
      owner_name: req.body.owner_name || null
    };

    const { data, error } = await supabase.from('receipts').update(updateData).eq('id', id).select();
    if (error) throw error;
    res.json({ success: true, receipt: mapReceipt(data[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/receipts/:id', async (req, res) => {
  try {
    const { data: receipt } = await supabase.from('receipts').select('photo_path').eq('id', req.params.id).single();
    if (receipt?.photo_path) await deleteReceiptPhoto(receipt.photo_path);
    const { error } = await supabase.from('receipts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// BULK OPERATIONS
// ============================================================

app.post('/api/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No ids' });
    
    const { data: receipts } = await supabase.from('receipts').select('photo_path').in('id', ids);
    for (const r of (receipts || [])) {
      if (r.photo_path) await deleteReceiptPhoto(r.photo_path);
    }
    
    const { error } = await supabase.from('receipts').delete().in('id', ids);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bulk-update-object', async (req, res) => {
  try {
    const { ids, object } = req.body;
    const { error } = await supabase.from('receipts').update({ object }).in('id', ids);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bulk-update-currency', async (req, res) => {
  try {
    const { ids, currency } = req.body;
    const { error } = await supabase.from('receipts').update({ currency }).in('id', ids);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// EXPORT
// ============================================================

app.post('/api/export-excel', async (req, res) => {
  try {
    const { receiptIds } = req.body;
    let query = supabase.from('receipts').select('*').order('created_at', { ascending: false });
    if (receiptIds && receiptIds.length > 0) query = query.in('id', receiptIds);
    
    const { data, error } = await query;
    if (error) throw error;
    
    let csv = '\uFEFFID;Магазин;Дата;Итого;Валюта;Товаров;Объект;Добавил\n';
    for (const r of mapReceipts(data)) {
      csv += `${r.id};${(r.store_name_ru || r.store_name || '').replace(/;/g, ',')};${r.receipt_date || r.purchase_date || ''};${r.total_amount || ''};${r.currency || ''};${r.items?.length || 0};${r.object || ''};${r.owner_name || r.owner_id || ''}\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=receipts.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// REPROCESS
// ============================================================

app.post('/api/reprocess-receipt', async (req, res) => {
  try {
    const { receiptId, model } = req.body;
    res.json({ success: true, message: 'Reprocessed (stub)' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// MODELS LIST
// ============================================================

const FALLBACK_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Gemini' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Gemini' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Gemini' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Gemini' },
  { id: 'groq-llama-3.2-90b', name: 'Groq Llama 3.2 90B', provider: 'Groq' },
  { id: 'groq-llama-3.2-11b', name: 'Groq Llama 3.2 11B', provider: 'Groq' },
  { id: 'groq-llama-4-scout', name: 'Groq Llama 4 Scout', provider: 'Groq' },
  { id: 'groq-llama-4-maverick', name: 'Groq Llama 4 Maverick', provider: 'Groq' },
  { id: 'ocrspace-engine1', name: 'OCR.space Engine 1', provider: 'OCR.space' },
  { id: 'ocrspace-engine2', name: 'OCR.space Engine 2', provider: 'OCR.space' },
  { id: 'ocrspace-engine3', name: 'OCR.space Engine 3', provider: 'OCR.space' },
];

app.get('/api/list-gemini-models', (req, res) => {
  res.json({ models: FALLBACK_MODELS.filter(m => m.provider === 'Gemini') });
});

app.get('/api/list-groq-models', (req, res) => {
  res.json({ models: FALLBACK_MODELS.filter(m => m.provider === 'Groq') });
});

app.get('/api/list-ocrspace-models', (req, res) => {
  res.json({ models: FALLBACK_MODELS.filter(m => m.provider === 'OCR.space') });
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============================================================
// START
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Receipt Manager Backend running');
  console.log('   Port:', PORT);
  console.log('   Health: http://localhost:' + PORT + '/health');
  console.log('   Supabase URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('   Supabase Key:', process.env.SUPABASE_KEY ? 'SET' : 'MISSING');
});