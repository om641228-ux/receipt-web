// ============================================================
// auth-owners.js — Авторизация + роли + владение чеками
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

// ====== АККАУНТЫ ======
const ACCOUNTS = [
  { id: 'admin',  name: 'Администратор',   role: 'admin', password: 'admin' },
  { id: 'user1',  name: 'Пользователь 1',  role: 'user',  password: 'user1' },
  { id: 'user2',  name: 'Пользователь 2',  role: 'user',  password: 'user2' },
  { id: 'user3',  name: 'Пользователь 3',  role: 'user',  password: 'user3' },
  { id: 'user4',  name: 'Пользователь 4',  role: 'user',  password: 'user4' },
  { id: 'user5',  name: 'Пользователь 5',  role: 'user',  password: 'user5' },
  { id: 'user6',  name: 'Пользователь 6',  role: 'user',  password: 'user6' },
  { id: 'user7',  name: 'Пользователь 7',  role: 'user',  password: 'user7' },
  { id: 'user8',  name: 'Пользователь 8',  role: 'user',  password: 'user8' },
  { id: 'user9',  name: 'Пользователь 9',  role: 'user',  password: 'user9' },
  { id: 'user10', name: 'Пользователь 10', role: 'user',  password: 'user10' },
];

// ====== Хранилище ======
const STORE_FILE = path.join(__dirname, 'owners-store.json');

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      console.log('📁 owners-store.json not found, creating new store');
      return { owners: {}, tokens: {} };
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    console.log('📁 Loaded store:', { ownersCount: Object.keys(parsed.owners || {}).length, tokensCount: Object.keys(parsed.tokens || {}).length });
    return {
      owners: parsed.owners && typeof parsed.owners === 'object' ? parsed.owners : {},
      tokens: parsed.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {},
    };
  } catch (e) {
    console.error('⚠️ Error loading store:', e.message);
    return { owners: {}, tokens: {} };
  }
}

function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
    console.log('💾 Store saved:', { ownersCount: Object.keys(store.owners).length, tokensCount: Object.keys(store.tokens).length });
  } catch (e) {
    console.error('❌ Store save error:', e.message);
  }
}

const store = loadStore();

function userByToken(token) {
  if (!token) return null;
  const userId = store.tokens[token];
  if (!userId) {
    console.log('🔍 Token not found in store. Tokens count:', Object.keys(store.tokens).length);
    return null;
  }
  return ACCOUNTS.find(a => a.id === userId) || null;
}

function publicUsers() {
  const map = {};
  ACCOUNTS.forEach(a => { map[a.id] = { name: a.name, role: a.role }; });
  return map;
}

// ====== РОУТЫ ======

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  console.log('🔑 Login attempt, password:', password);
  const acc = ACCOUNTS.find(a => a.password === password);
  if (!acc) {
    console.log('❌ Login failed: wrong password');
    return res.json({ success: false, error: 'Неверный пароль' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  store.tokens[token] = acc.id;
  saveStore();
  console.log('✅ Login success:', acc.id, 'token:', token.substring(0, 16) + '...');
  res.json({ success: true, token, user: { id: acc.id, name: acc.name, role: acc.role } });
});

router.post('/logout', (req, res) => {
  const { token } = req.body || {};
  if (token && store.tokens[token]) { delete store.tokens[token]; saveStore(); }
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const user = userByToken(req.query.token);
  if (!user) return res.json({ success: false });
  res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
});

router.get('/owners', (req, res) => {
  res.json({ success: true, owners: store.owners, users: publicUsers() });
});

router.post('/set-owner', (req, res) => {
  const { token, receiptId } = req.body || {};
  const user = userByToken(token);
  if (!user) return res.status(401).json({ success: false, error: 'Не авторизован' });
  if (receiptId === undefined || receiptId === null) {
    return res.json({ success: false, error: 'Не указан receiptId' });
  }
  store.owners[String(receiptId)] = user.id;
  saveStore();
  console.log('🔐 Owner set via API:', user.id, '-> receipt', receiptId);
  res.json({ success: true });
});

// ============================================================
// MIDDLEWARE
// ============================================================

function extractToken(req) {
  // 1. Authorization header
  const h = req.headers && req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);

  // 2. Body (JSON or form-data after multer)
  if (req.body && req.body.token) return req.body.token;

  // 3. Query string
  if (req.query && req.query.token) return req.query.token;

  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  console.log('🔍 Auth check START');
  console.log('🔍 path:', req.path, 'method:', req.method);
  console.log('🔍 token found:', !!token, 'token prefix:', token ? token.substring(0, 20) + '...' : 'none');
  console.log('🔍 req.body keys:', req.body ? Object.keys(req.body) : 'no body');
  console.log('🔍 req.query keys:', req.query ? Object.keys(req.query) : 'no query');

  if (!token) {
    console.log('❌ No token provided. Query:', req.query, 'Body keys:', req.body ? Object.keys(req.body) : 'no body');
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }

  const user = userByToken(token);
  if (!user) {
    console.log('❌ Invalid token. Token value:', token ? token.substring(0, 30) + '...' : 'undefined');
    console.log('❌ Available tokens count:', Object.keys(store.tokens).length);
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.userName = user.name;
  req.user = { id: user.id, name: user.name, role: user.role };
  console.log('✅ Auth OK - SET req.user =', JSON.stringify(req.user));
  console.log('✅ Auth OK - userId:', req.userId, 'role:', req.userRole);
  next();
}

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Требуется роль администратора' });
  }
  next();
}

function scopeReceiptsByOwner(req, res, next) {
  if (req.userRole === 'admin') {
    console.log('👑 Admin access - no filtering');
    return next();
  }
  const userId = req.userId;
  console.log('🔍 Filtering receipts for user:', userId, 'Owners count:', Object.keys(store.owners).length);

  const filterArr = (arr) => {
    if (!Array.isArray(arr)) return arr;
    const filtered = arr.filter(r => store.owners[String(r.id)] === userId);
    console.log('📊 Filtered:', filtered.length, 'of', arr.length);
    return filtered;
  };

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      if (Array.isArray(body)) body = filterArr(body);
      else if (body && Array.isArray(body.receipts)) body = { ...body, receipts: filterArr(body.receipts) };
      else if (body && Array.isArray(body.data)) body = { ...body, data: filterArr(body.data) };
    } catch (e) { console.error('Filter error:', e); }
    return originalJson(body);
  };
  next();
}

function filterOwned(arr, userId) {
  return Array.isArray(arr) ? arr.filter(r => store.owners[String(r.id)] === userId) : arr;
}

function setOwner(receiptId, userId) {
  store.owners[String(receiptId)] = userId;
  saveStore();
  console.log('🔐 Owner set:', userId, '-> receipt', receiptId);
}

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.scopeReceiptsByOwner = scopeReceiptsByOwner;
module.exports.filterOwned = filterOwned;
module.exports.setOwner = setOwner;
module.exports.userByToken = userByToken;