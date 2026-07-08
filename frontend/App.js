import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Capacitor, registerPlugin } from '@capacitor/core';

// ⚠️ ЗАМЕНИТЕ на реальный URL вашего backend из Railway!
// Как найти: Railway Dashboard → сервис receipt-web-back → Settings → Domain
// Пример: https://receipt-web-back-production.up.railway.app
const API_URL = 'https://recept-web-back-production.up.railway.app';

const OBJECTS = ['other', 'Duqe', 'Maria', 'Kit', 'Dubai', 'Tich'];
const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 'all'];
const MAX_FILE_SIZE_MB = 2;

const fixImageUrl = (url) => {
  if (!url) return null;
  return url.replace(/^http:\/\//, 'https://');
};

const FALLBACK_MODELS = [
  { name: 'ocrspace-engine1', displayName: 'OCR.space Engine 1 (Basic)', provider: 'OCR.space' },
  { name: 'ocrspace-engine2', displayName: 'OCR.space Engine 2 (Advanced)', provider: 'OCR.space' },
  { name: 'ocrspace-engine3', displayName: 'OCR.space Engine 3 (Handwriting)', provider: 'OCR.space' },
  { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'Gemini' },
  { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', provider: 'Gemini' },
  { name: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', provider: 'Gemini' },
  { name: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', provider: 'Gemini' },
  { name: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite', provider: 'Gemini' },
  { name: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', provider: 'Gemini' },
  { name: 'gemini-3-pro-image', displayName: 'Gemini 3 Pro Image', provider: 'Gemini' },
  { name: 'gemini-3.1-flash-image', displayName: 'Gemini 3.1 Flash Image', provider: 'Gemini' },
  { name: 'gemini-flash-latest', displayName: 'Gemini Flash Latest', provider: 'Gemini' },
  { name: 'gemini-pro-latest', displayName: 'Gemini Pro Latest', provider: 'Gemini' },
  { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', provider: 'Gemini' },
  { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', provider: 'Gemini' },
  { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', provider: 'Gemini' },
  { name: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash Lite', provider: 'Gemini' },
  { name: 'groq-llama-3.2-90b', displayName: 'Groq Llama 3.2 90B Vision', provider: 'Groq' },
  { name: 'groq-llama-3.2-11b', displayName: 'Groq Llama 3.2 11B Vision', provider: 'Groq' },
  { name: 'groq-llama-4-scout', displayName: 'Groq Llama 4 Scout', provider: 'Groq' },
  { name: 'groq-llama-4-maverick', displayName: 'Groq Llama 4 Maverick', provider: 'Groq' },
  { name: 'groq-qwen3.6-27b', displayName: 'Groq Qwen3.6 27B', provider: 'Groq' },
  { name: 'groq-llama-3.3-70b', displayName: 'Groq Llama 3.3 70B', provider: 'Groq' },
  { name: 'groq-compound', displayName: 'Groq Compound', provider: 'Groq' },
  { name: 'groq-compound-mini', displayName: 'Groq Compound Mini', provider: 'Groq' },
  { name: 'groq-allam-2-7b', displayName: 'Groq Allam 2 7B', provider: 'Groq' },
  { name: 'groq-llama-3.1-8b', displayName: 'Groq Llama 3.1 8B', provider: 'Groq' },
  { name: 'groq-llama-prompt-guard-2-22m', displayName: 'Groq Prompt Guard 2 22M', provider: 'Groq' },
  { name: 'groq-llama-prompt-guard-2-86m', displayName: 'Groq Prompt Guard 2 86M', provider: 'Groq' },
  { name: 'groq-gpt-oss-120b', displayName: 'Groq GPT-OSS 120B', provider: 'Groq' },
  { name: 'groq-gpt-oss-20b', displayName: 'Groq GPT-OSS 20B', provider: 'Groq' },
  { name: 'groq-gpt-oss-safeguard-20b', displayName: 'Groq GPT-OSS Safeguard 20B', provider: 'Groq' },
  { name: 'groq-qwen3-32b', displayName: 'Groq Qwen3 32B', provider: 'Groq' },
  { name: 'groq-mixtral', displayName: 'Groq Mixtral', provider: 'Groq' },
  { name: 'groq-gemma', displayName: 'Groq Gemma', provider: 'Groq' },
];

function compressImageFile(file, maxWidth = 1600, maxHeight = 2400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (file.size <= MAX_FILE_SIZE_MB * 1024 * 1024) {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; }
        if (height > maxHeight) { width = Math.round(width * (maxHeight / height)); height = maxHeight; }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg', lastModified: Date.now()
          });
          console.log(`Frontend compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function HighlightText({ text, query, style = {} }) {
  if (!query || !text) return <span style={style}>{text || ''}</span>;
  const q = query.toLowerCase().trim();
  if (!q) return <span style={style}>{text}</span>;
  const str = String(text);
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = str.split(regex);
  return (
    <span style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === q ? (
          <mark key={i} style={{ backgroundColor: '#ffeb3b', color: '#000', padding: '0 2px', borderRadius: 2, fontWeight: 600 }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// Регистрируем плагин один раз глобально (не внутри компонента)
const ReceiptScanner = registerPlugin('ReceiptScannerPlugin');

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('upload');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'ok' | 'error'

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const [lastSavedReceipt, setLastSavedReceipt] = useState(null);
  const [scanResultOpen, setScanResultOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('groq-llama-4-scout');
  const [currency, setCurrency] = useState('auto');
  const [docType, setDocType] = useState('receipt');
  const [object, setObject] = useState('other');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [exportMode, setExportMode] = useState('all');

  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [filterType, setFilterType] = useState('all');
  const [filterObject, setFilterObject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedReceiptIds, setSelectedReceiptIds] = useState(new Set());
  const [viewModal, setViewModal] = useState(null);

  const [folderProgress, setFolderProgress] = useState({ active: false, current: 0, total: 0, success: 0, errors: 0, currentFile: '' });
  const [folderResults, setFolderResults] = useState([]);

  const receiptCount = receipts.filter(r => r.document_type === 'receipt' || !r.document_type).length;
  const invoiceCount = receipts.filter(r => r.document_type === 'invoice').length;

  // === Проверка доступности сервера ===
  const checkServerHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_URL}/health`, { 
        method: 'GET',
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeout);
      if (res.ok) {
        setServerStatus('ok');
        return true;
      }
      setServerStatus('error');
      return false;
    } catch (e) {
      console.error('Server health check failed:', e.message);
      setServerStatus('error');
      return false;
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, [checkServerHealth]);

  useEffect(() => {
    return () => { previewUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [previewUrls]);

  // === iOS NATIVE SCANNER v2 ===
  // Плагин зарегистрирован один раз за пределами компонента (см. выше)

  const scanDocumentNative = async () => {
    console.log('[SCANNER] Platform:', Capacitor.getPlatform());
    if (Capacitor.getPlatform() !== 'ios') {
      console.log('[SCANNER] Not iOS, skipping');
      return null;
    }
    try {
      console.log('[SCANNER] Calling scanDocument...');
      const result = await ReceiptScanner.scanDocument();
      console.log('[SCANNER] Result:', result);
      return result?.image || null;
    } catch (e) {
      console.error('[SCANNER] Error:', e);
      alert('Scanner error: ' + (e.message || JSON.stringify(e)));
      return null;
    }
  };

  const handleCameraClick = async () => {
    console.log('[CAMERA] Button clicked');
    console.log('[CAMERA] Platform:', Capacitor.getPlatform());
    if (Capacitor.getPlatform() === 'ios') {
      console.log('[CAMERA] Using native scanner...');
      const imageBase64 = await scanDocumentNative();
      console.log('[CAMERA] Got image:', imageBase64 ? 'YES' : 'NO');
      if (imageBase64) {
        const response = await fetch(imageBase64);
        const blob = await response.blob();
        const file = new File([blob], 'scanned_receipt.jpg', { type: 'image/jpeg' });
        const url = URL.createObjectURL(file);
        setSelectedFiles([file]);
        setCurrentFileIndex(0);
        setPreviewUrls([url]);
        setPreviewUrl(url);
        setLastSavedReceipt(null);
        setFolderResults([]);
        setScanResultOpen(true);
        recognizeAndSave(file);
      }
    } else {
      console.log('[CAMERA] Fallback to file input');
      document.getElementById('file-input').click();
    }
  };

  const login = async () => {
    setLoginError('');

    // Сначала проверяем сервер
    const isServerOk = await checkServerHealth();
    if (!isServerOk) {
      setLoginError(`Сервер недоступен. Проверьте URL: ${API_URL}`);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: `Сервер вернул ${res.status}` }; }
        setLoginError(data.error || `Ошибка сервера: ${res.status}`);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        loadReceipts(data.token);
      } else {
        setLoginError(data.error || 'Неверный пароль');
      }
    } catch (e) {
      console.error('Login error:', e);
      if (e.name === 'AbortError') {
        setLoginError('Сервер не отвечает (таймаут). Проверьте URL бэкенда.');
      } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        setLoginError(`Не удалось подключиться к серверу. URL: ${API_URL}`);
      } else {
        setLoginError('Ошибка соединения: ' + e.message);
      }
    }
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setReceipts([]);
    setAuthChecking(false);
    setSelectedReceiptIds(new Set());
  }, []);

  const loadReceipts = useCallback(async (authToken = token) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_URL}/api/receipts?token=${authToken}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.receipts || []);
      const processed = raw.map(r => {
        let items = r.items;
        if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
        if (!Array.isArray(items)) items = [];
        return { 
          ...r, 
          image_url: fixImageUrl(r.photo_url || r.image_url), 
          items: items, 
          raw_text: r.raw_text || r.recognized_text || '' 
        };
      });
      setReceipts(processed);
      setSelectedReceiptIds(new Set());
      setCurrentPage(1);
    } catch (e) {
      console.error('Ошибка загрузки чеков:', e);
      setReceipts([]);
    }
    setLoading(false);
  }, [token, logout]);

  useEffect(() => {
    if (token) {
      setAuthChecking(true);
      fetch(`${API_URL}/api/me?token=${token}`, { signal: AbortSignal.timeout(8000) })
        .then(async r => { if (!r.ok) throw new Error('Auth failed'); return r.json(); })
        .then(data => {
          const userData = data.user || data;
          if ((data.success !== false) && (userData.id || userData.valid || data.id)) {
            setUser(userData);
            loadReceipts(token);
          } else throw new Error('Invalid token');
        })
        .catch(err => { console.error('Auth check error:', err); logout(); })
        .finally(() => setAuthChecking(false));
    } else {
      setAuthChecking(false);
    }
  }, [token, loadReceipts, logout]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      const urls = files.map(f => URL.createObjectURL(f));
      setSelectedFiles(files);
      setCurrentFileIndex(0);
      setPreviewUrls(urls);
      setPreviewUrl(urls[0]);
      setLastSavedReceipt(null);
      setFolderResults([]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      const urls = files.map(f => URL.createObjectURL(f));
      setSelectedFiles(files);
      setCurrentFileIndex(0);
      setPreviewUrls(urls);
      setPreviewUrl(urls[0]);
      setLastSavedReceipt(null);
      setFolderResults([]);
    }
  };

  const nextFile = () => {
    if (currentFileIndex < selectedFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      setPreviewUrl(previewUrls[currentFileIndex + 1]);
      setLastSavedReceipt(null);
    }
  };

  const prevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
      setPreviewUrl(previewUrls[currentFileIndex - 1]);
      setLastSavedReceipt(null);
    }
  };

  const recognizeAndSave = async (fileArg) => {
    const file = (fileArg instanceof File) ? fileArg : selectedFiles[currentFileIndex];
    if (!file) return;
    setRecognizing(true);
    setLastSavedReceipt(null);
    try {
      let fileToUpload = file;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        console.log(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB), compressing...`);
        fileToUpload = await compressImageFile(file);
      }
      const formData = new FormData();
      formData.append('image', fileToUpload);
      formData.append('model', selectedModel);
      formData.append('currency', currency);
      formData.append('docType', docType);
      formData.append('object', object);
      formData.append('token', token);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${API_URL}/api/upload-receipt?token=${token}`, { 
        method: 'POST', 
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Сервер вернул ${res.status}: ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data.error || data.message || `Ошибка сервера: ${res.status}`);
      if (!data.success && !data.id) throw new Error(data.error || 'Сохранение не удалось');

      const receiptData = data.data || data;
      if (receiptData.image_url) receiptData.image_url = fixImageUrl(receiptData.image_url);
      setLastSavedReceipt(receiptData);
      loadReceipts();
    } catch (e) {
      console.error('Ошибка:', e);
      alert('Ошибка: ' + e.message);
    }
    setRecognizing(false);
  };

  const clearScanState = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    setPreviewUrl(null);
    setCurrentFileIndex(0);
    setLastSavedReceipt(null);
  };

  const finishScan = () => {
    setScanResultOpen(false);
    clearScanState();
  };

  const rescanScan = async () => {
    const r = lastSavedReceipt;
    setScanResultOpen(false);
    clearScanState();
    if (r && r.id) {
      try { await fetch(`${API_URL}/api/receipts/${r.id}?token=${token}`, { method: 'DELETE' }); } catch (e) {}
      loadReceipts();
    }
    handleCameraClick();
  };

  const handleFolderSelect = async (e) => {
    const allFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (allFiles.length === 0) {
      alert('В папке не найдено изображений');
      return;
    }

    setFolderProgress({ active: true, current: 0, total: allFiles.length, success: 0, errors: 0, currentFile: '' });
    setFolderResults([]);
    setRecognizing(true);

    const results = [];

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      setFolderProgress(prev => ({ ...prev, current: i + 1, currentFile: file.name }));

      try {
        let fileToUpload = file;
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          fileToUpload = await compressImageFile(file);
        }

        const formData = new FormData();
        formData.append('image', fileToUpload);
        formData.append('model', selectedModel);
        formData.append('currency', currency);
        formData.append('docType', docType);
        formData.append('object', object);
        formData.append('token', token);

        const res = await fetch(`${API_URL}/api/upload-receipt?token=${token}`, { method: 'POST', body: formData });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error(`Сервер вернул ${res.status}`); }

        if (!res.ok || (!data.success && !data.id)) {
          throw new Error(data.error || `Ошибка сервера: ${res.status}`);
        }

        const receiptData = data.data || data;
        if (receiptData.image_url) receiptData.image_url = fixImageUrl(receiptData.image_url);
        results.push({ file: file.name, status: 'success', receipt: receiptData });
        setFolderProgress(prev => ({ ...prev, success: prev.success + 1 }));
      } catch (err) {
        console.error(`Folder upload error for ${file.name}:`, err);
        results.push({ file: file.name, status: 'error', error: err.message });
        setFolderProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
      }
    }

    setFolderResults(results);
    setFolderProgress(prev => ({ ...prev, active: false, currentFile: '' }));
    setRecognizing(false);
    loadReceipts();

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    if (errorCount === 0) {
      alert(`✅ Все ${successCount} чеков успешно распознаны и сохранены!`);
    } else {
      alert(`✅ Успешно: ${successCount}
❌ Ошибок: ${errorCount}

Смотрите детали ниже.`);
    }
  };

  const deleteReceipt = async (id) => {
    if (!window.confirm('Удалить чек?')) return;
    try {
      const res = await fetch(`${API_URL}/api/receipts/${id}?token=${token}`, { method: 'DELETE' });
      if (res.ok) { loadReceipts(); if (viewModal && viewModal.id === id) setViewModal(null); }
      else alert('Ошибка удаления');
    } catch (e) { console.error('Ошибка удаления:', e); }
  };

  const exportExcel = async (ids = []) => {
    try {
      const res = await fetch(`${API_URL}/api/export-excel?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptIds: ids })
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'receipts.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Ошибка экспорта:', e);
      alert('Ошибка экспорта');
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateReceiptCSV = (receipt) => {
    const items = receipt.items || [];
    let csv = '\uFEFFМагазин;Дата;Валюта;Товар;Кол-во;Цена;Сумма\n';
    items.forEach(item => {
      csv += [
        (receipt.store_name || '').replace(/;/g, ','),
        receipt.receipt_date || receipt.date || '',
        receipt.currency || '',
        (item.name || item.name_ru || '').replace(/;/g, ','),
        item.quantity || 1,
        item.price || '',
        item.total || ((item.price || 0) * (item.quantity || 1))
      ].join(';') + '\n';
    });
    csv += `;;ИТОГО;${receipt.total_amount || ''};;\n`;
    return csv;
  };

  const handleExport = async () => {
    if (selectedReceiptIds.size === 0) return alert('Выберите чеки');
    const selected = receipts.filter(r => selectedReceiptIds.has(r.id));

    let dirHandle = null;
    let useFolder = false;

    if (window.showDirectoryPicker) {
      try {
        dirHandle = await window.showDirectoryPicker();
        useFolder = true;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('showDirectoryPicker error:', err);
      }
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!useFolder && isMobile) {
      alert('На этом устройстве выбор папки не поддерживается. Файлы будут скачаны в папку «Загрузки».');
    }

    const formats = [];
    if (exportMode === 'all') {
      formats.push('excel', 'text', 'photo');
    } else {
      formats.push(exportMode);
    }

    let savedCount = 0;

    for (const receipt of selected) {
      const safeName = (receipt.store_name || 'receipt')
        .replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '_')
        .substring(0, 40);
      const folderName = `${safeName}_${String(receipt.id).slice(-4)}`;

      let subDir = null;
      if (dirHandle) {
        try {
          subDir = await dirHandle.getDirectoryHandle(folderName, { create: true });
        } catch (e) {
          console.error('Cannot create subdir:', e);
        }
      }

      if (formats.includes('excel')) {
        try {
          const csv = generateReceiptCSV(receipt);
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          if (subDir) {
            const fileHandle = await subDir.getFileHandle('receipt.csv', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            savedCount++;
          } else {
            downloadBlob(blob, `${folderName}.csv`);
            await new Promise(r => setTimeout(r, 300));
          }
        } catch (e) {
          console.error('CSV export error:', e);
        }
      }

      if (formats.includes('text')) {
        const text = receipt.raw_text || receipt.recognized_text || '';
        if (text) {
          try {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            if (subDir) {
              const fileHandle = await subDir.getFileHandle('recognized_text.txt', { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              savedCount++;
            } else {
              downloadBlob(blob, `${folderName}_text.txt`);
              await new Promise(r => setTimeout(r, 300));
            }
          } catch (e) {
            console.error('Text export error:', e);
          }
        }
      }

      if (formats.includes('photo')) {
        if (receipt.photo_url || receipt.image_url) {
          try {
            const res = await fetch(fixImageUrl(receipt.photo_url || receipt.image_url));
            const blob = await res.blob();
            const ext = ((receipt.photo_url || receipt.image_url).split('.').pop().split('?')[0]) || 'jpg';
            if (subDir) {
              const fileHandle = await subDir.getFileHandle(`receipt.${ext}`, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              savedCount++;
            } else {
              downloadBlob(blob, `${folderName}_image.${ext}`);
              await new Promise(r => setTimeout(r, 400));
            }
          } catch (e) {
            console.error('Photo export error:', e);
          }
        }
      }
    }

    if (useFolder) {
      alert(`✅ Экспорт завершён! Сохранено файлов/папок: ${savedCount}`);
    } else {
      alert('✅ Скачивание завершено!');
    }
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Удалить ${selectedReceiptIds.size} чеков?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/bulk-delete?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedReceiptIds) })
      });
      if (res.ok) { setSelectedReceiptIds(new Set()); loadReceipts(); }
      else alert('Ошибка массового удаления');
    } catch (e) { console.error(e); }
  };

  const bulkChangeObject = async (newObject) => {
    if (selectedReceiptIds.size === 0) return;
    try {
      const res = await fetch(`${API_URL}/api/bulk-update-object?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedReceiptIds), object: newObject })
      });
      if (res.ok) { setSelectedReceiptIds(new Set()); loadReceipts(); }
      else alert('Ошибка смены объекта');
    } catch (e) { console.error(e); }
  };

  const bulkChangeCurrency = async (newCurrency) => {
    if (selectedReceiptIds.size === 0) return;
    try {
      const res = await fetch(`${API_URL}/api/bulk-update-currency?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedReceiptIds), currency: newCurrency })
      });
      if (res.ok) { setSelectedReceiptIds(new Set()); loadReceipts(); }
      else alert('Ошибка смены валюты');
    } catch (e) { console.error(e); }
  };

  const bulkReprocess = async () => {
    if (!window.confirm(`Перераспознать ${selectedReceiptIds.size} чеков?`)) return;
    setLoading(true);
    const ids = Array.from(selectedReceiptIds);
    for (const id of ids) {
      try {
        await fetch(`${API_URL}/api/reprocess-receipt?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptId: id, model: selectedModel })
        });
      } catch (e) { console.error('Reprocess error', e); }
    }
    setSelectedReceiptIds(new Set());
    loadReceipts();
    setLoading(false);
  };

  const toggleSelect = (id) => {
    setSelectedReceiptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const newSet = new Set(selectedReceiptIds);
    paginatedReceipts.forEach(r => newSet.add(r.id));
    setSelectedReceiptIds(newSet);
  };

  const deselectAll = () => setSelectedReceiptIds(new Set());

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const endpoints = [
        { url: `${API_URL}/api/list-gemini-models`, provider: 'Gemini' },
        { url: `${API_URL}/api/list-groq-models`, provider: 'Groq' },
        { url: `${API_URL}/api/list-ocrspace-models`, provider: 'OCR.space' }
      ];
      let allModels = [];
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint.url);
          if (res.ok) {
            const data = await res.json();
            if (data.models) allModels = [...allModels, ...data.models.map(m => ({ name: m.id, displayName: m.name || m.id, provider: endpoint.provider, status: 'ok' }))];
          }
        } catch (e) {}
      }
      if (allModels.length === 0) allModels = FALLBACK_MODELS;
      setModels(allModels);
    } catch (e) { setModels(FALLBACK_MODELS); }
    setModelsLoading(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  const formatAmount = (amount, currency) => {
    if (amount === null || amount === undefined) return '—';
    return `${parseFloat(amount).toFixed(2)} ${currency || ''}`;
  };

  const getProviderColor = (provider) => {
    const colors = { 'Gemini': '#4285f4', 'Groq': '#f55036', 'OCR.space': '#00a86b' };
    return colors[provider] || '#888';
  };

  const calculateItemsTotal = (items) => {
    if (!items || !items.length) return 0;
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      const total = parseFloat(item.total) || (qty * price);
      return sum + total;
    }, 0);
  };

  const filteredReceipts = receipts.filter(r => {
    if (filterType !== 'all' && r.document_type !== filterType) return false;
    if (filterObject !== 'all' && r.object !== filterObject) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const searchFields = [
      String(r.id || ''),
      String(r.store_name_ru || r.store_name || ''),
      String(r.raw_text || r.recognized_text || ''),
      String(r.object || ''),
      String(r.currency || ''),
      String(r.owner_name || r.owner_id || ''),
      String(r.document_type || ''),
      String(r.total_amount || ''),
      String(r.subtotal || ''),
      String(r.tax_amount || ''),
      String(r.tax_rate || ''),
      String(r.receipt_date || ''),
      String(r.receipt_time || ''),
      String(r.receipt_address || ''),
      String(r.phone || ''),
      String(r.card_last4 || ''),
      String(r.recognition_method || ''),
      String(r.warning || ''),
      String(r.notes || ''),
      String(r.payment_method || ''),
      String(r.discount_amount || ''),
      String(r.loyalty_card || ''),
    ];

    const itemsText = (r.items || []).map(i =>
      `${i.name || ''} ${i.name_ru || ''} ${i.price || ''} ${i.quantity || ''} ${i.total || ''} ${i.category || ''} ${i.sku || ''}`
    ).join(' ');

    const allText = searchFields.join(' ') + ' ' + itemsText;
    return allText.toLowerCase().includes(q);
  });

  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(filteredReceipts.length / itemsPerPage);
  const paginatedReceipts = itemsPerPage === 'all'
    ? filteredReceipts
    : filteredReceipts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatUserName = (u) => {
    if (!u) return 'Гость';
    if (u.name && u.name !== 'admin' && !u.name.startsWith('user')) return u.name;
    if (u.email) return u.email.split('@')[0];
    if (u.role === 'admin') return 'Администратор';
    return 'Пользователь';
  };

  const formatOwnerName = (receipt) => {
    if (receipt.owner_name && receipt.owner_name !== 'admin' && !receipt.owner_name.startsWith('user')) {
      return receipt.owner_name;
    }
    if (receipt.owner_id) {
      return `Пользователь ${receipt.owner_id}`;
    }
    return '—';
  };

  if (authChecking) {
    return (
      <div className="App">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="App">
        <div className="login-box">
          <h1>Receipt Manager</h1>

          {/* Индикатор статуса сервера */}
          <div style={{ 
            padding: '8px 12px', 
            borderRadius: 6, 
            marginBottom: 12, 
            fontSize: 13,
            background: serverStatus === 'ok' ? '#d4edda' : serverStatus === 'error' ? '#f8d7da' : '#fff3cd',
            color: serverStatus === 'ok' ? '#155724' : serverStatus === 'error' ? '#721c24' : '#856404',
            border: `1px solid ${serverStatus === 'ok' ? '#c3e6cb' : serverStatus === 'error' ? '#f5c6cb' : '#ffeeba'}`
          }}>
            {serverStatus === 'checking' && '⏳ Проверка сервера...'}
            {serverStatus === 'ok' && '✅ Сервер доступен'}
            {serverStatus === 'error' && `❌ Сервер недоступен: ${API_URL}`}
          </div>

          <input type="password" placeholder="Введите пароль" value={password} onChange={e => setPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && login()} />
          <button onClick={login} disabled={serverStatus === 'checking'}>
            {serverStatus === 'checking' ? 'Проверка...' : 'Войти'}
          </button>

          {loginError && (
            <div style={{ marginTop: 10, padding: 10, background: '#f8d7da', borderRadius: 6, color: '#721c24', fontSize: 13 }}>
              <strong>Ошибка:</strong> {loginError}
              <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
                URL бэкенда: <code style={{ background: '#eee', padding: '2px 4px', borderRadius: 3 }}>{API_URL}</code>
                <br/>
                Проверьте в Railway Dashboard → receipt-web-back → Settings → Domain
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="mini-header">
        <div className="header-left">
          <span className="logo-icon"></span>
          <span className="user-name">{formatUserName(user)} {user?.role === 'admin' ? '' : ''}</span>
        </div>
        <div className="header-right">
          <button className="logout-btn" onClick={logout}> Выйти</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={activeTab === 'upload' ? 'active' : ''} onClick={() => setActiveTab('upload')}> Загрузка</button>
        <button className={activeTab === 'list' ? 'active' : ''} onClick={() => {setActiveTab('list'); loadReceipts();}}>
           Чеки ({receiptCount}) · Фактуры ({invoiceCount})
        </button>
      </nav>

      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2> Чек #{viewModal.id}</h2>
              <button className="modal-close" onClick={() => setViewModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-image-section">
                {(viewModal.photo_url || viewModal.image_url) ? <img src={fixImageUrl(viewModal.photo_url || viewModal.image_url)} alt="Чек" className="modal-image" /> : <div className="no-image">Нет фото</div>}
              </div>
              <div className="modal-info">
                <div className="info-block">
                  <h3>Основная информация</h3>
                  <p><strong>Магазин:</strong> <HighlightText text={viewModal.store_name_ru || viewModal.store_name || '—'} query={searchQuery} /></p>
                  <p><strong>Дата:</strong> {formatDate(viewModal.receipt_date)} {viewModal.receipt_time}</p>
                  <p><strong>Итого:</strong> {formatAmount(viewModal.total_amount, viewModal.currency)}</p>
                  <p><strong>Тип:</strong> {viewModal.document_type}</p>
                  <p><strong>Объект:</strong> <HighlightText text={viewModal.object || '—'} query={searchQuery} /></p>
                  <p><strong>Метод:</strong> {viewModal.recognition_method || '—'}</p>
                  <p><strong>Добавил:</strong> <HighlightText text={formatOwnerName(viewModal)} query={searchQuery} /></p>
                  {viewModal.subtotal && <p><strong>Подытог:</strong> {viewModal.subtotal}</p>}
                  {viewModal.tax_amount && <p><strong>Налог:</strong> {viewModal.tax_amount} ({viewModal.tax_rate || ''})</p>}
                  {(() => {
                    const itemsTotal = calculateItemsTotal(viewModal.items);
                    const total = parseFloat(viewModal.total_amount) || 0;
                    const diff = Math.abs(total - itemsTotal).toFixed(2);
                    if (diff > 0.01) {
                      return (
                        <p style={{ color: '#e74c3c', fontWeight: 600 }}>
                           Разница: {diff} {viewModal.currency || ''}
                          <br/><small>(Сумма строк: {itemsTotal.toFixed(2)} ≠ Итого: {total.toFixed(2)})</small>
                        </p>
                      );
                    }
                    return <p style={{ color: '#27ae60' }}> Сумма строк совпадает</p>;
                  })()}
                </div>
                <div className="info-block">
                  <h3>Товары ({viewModal.items?.length || 0})</h3>
                  <table className="items-table">
                    <thead><tr><th>№</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
                    <tbody>
                      {(viewModal.items || []).map((item, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><HighlightText text={item.name_ru || item.name || '—'} query={searchQuery} /></td>
                          <td>{item.quantity}</td>
                          <td>{item.price}</td>
                          <td>{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {viewModal.raw_text && (
                  <div className="info-block">
                    <h3>Распознанный текст</h3>
                    <pre className="raw-text"><HighlightText text={viewModal.raw_text} query={searchQuery} /></pre>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setViewModal(null)}>Закрыть</button>
              {user?.role === 'admin' && (
                <button className="danger" onClick={() => deleteReceipt(viewModal.id)}> Удалить</button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="upload-section">
          <div className="top-controls">
            <button className="model-toggle-btn" onClick={() => {setShowModelSelector(!showModelSelector); loadModels();}}>
               {showModelSelector ? 'Скрыть' : `Выбор модели (${models.length || '...'})`}
            </button>
            {showModelSelector && (
              <div className="model-dropdown" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {modelsLoading ? <p>Загрузка...</p> : (
                  <div className="models-grid">
                    {models.map(model => (
                      <div key={`${model.provider}-${model.name}`} className={`model-option ${selectedModel === model.name ? 'selected' : ''}`}
                           onClick={() => { setSelectedModel(model.name); setShowModelSelector(false); }} title={`${model.provider} — ${model.displayName}`}>
                        <span className="provider-badge" style={{ backgroundColor: getProviderColor(model.provider) }}>{model.provider}</span>
                        <span className="model-name">{model.displayName}</span>
                        <span className="status-ok">✅</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="current-model"><small>Модель: <strong>{selectedModel}</strong></small></div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 15 }}>
            <button
              onClick={handleCameraClick}
              style={{
                flex: 1,
                padding: '14px 20px',
                background: '#27ae60',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              📷 {Capacitor.getPlatform() === 'ios' ? 'Камера (сканер чеков)' : 'Фото'}
            </button>
            <label
              htmlFor="file-input"
              style={{
                flex: 1,
                padding: '14px 20px',
                background: '#3498db',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textAlign: 'center'
              }}
            >
              📁 Выбрать файл
            </label>
          </div>

          <div className="drop-zone" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
            <input type="file" accept="image/*" multiple onChange={handleFileSelect} id="file-input" style={{ display: 'none' }} />
            <label htmlFor="file-input" style={{ display: 'block', width: '100%', cursor: 'pointer' }}>
              {previewUrl ? (
                <div className="preview-container">
                  <img src={previewUrl} alt="Preview" className="preview" />
                  {selectedFiles.length > 1 && (
                    <div className="file-nav">
                      <button onClick={(e) => {e.preventDefault(); prevFile();}} disabled={currentFileIndex === 0}>◀</button>
                      <span>{currentFileIndex + 1} / {selectedFiles.length}</span>
                      <button onClick={(e) => {e.preventDefault(); nextFile();}} disabled={currentFileIndex === selectedFiles.length - 1}>▶</button>
                    </div>
                  )}
                  {selectedFiles[currentFileIndex] && (
                    <p style={{ fontSize: 12, color: '#7f8c8d', marginTop: 5 }}>
                      Размер: {(selectedFiles[currentFileIndex].size / 1024 / 1024).toFixed(2)} MB
                      {selectedFiles[currentFileIndex].size > MAX_FILE_SIZE_MB * 1024 * 1024 && ' (будет сжато)'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="drop-text">
                  <p> Перетащите фото чека сюда</p>
                  <p>или нажмите для выбора файлов</p>
                  <p className="hint">Можно выбрать несколько файлов</p>
                </div>
              )}
            </label>
          </div>

          <div style={{ marginTop: 15, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="file"
              id="folder-input"
              webkitdirectory=""
              directory=""
              multiple
              accept="image/*"
              onChange={handleFolderSelect}
              style={{ display: 'none' }}
            />
            <label
              htmlFor="folder-input"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                background: '#9b59b6',
                color: '#fff',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 15,
                userSelect: 'none'
              }}
            >
               Распознать папку
            </label>
            <span style={{ fontSize: 13, color: '#7f8c8d' }}>
              Выберите папку — все фото из неё будут распознаны автоматически
            </span>
          </div>

          {folderProgress.active && (
            <div className="folder-progress">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong> Распознавание папки...</strong>
                <span>{folderProgress.current} / {folderProgress.total}</span>
              </div>
              <div className="folder-progress-bar">
                <div style={{
                  width: `${folderProgress.total > 0 ? (folderProgress.current / folderProgress.total * 100) : 0}%`
                }} />
              </div>
              <p style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
                {folderProgress.currentFile}
              </p>
              <p style={{ fontSize: 13, color: '#27ae60', marginTop: 4 }}>
                 Успешно: {folderProgress.success} &nbsp;|&nbsp;
                <span style={{ color: '#e74c3c' }}>❌ Ошибок: {folderProgress.errors}</span>
              </p>
            </div>
          )}

          {folderResults.length > 0 && !folderProgress.active && (
            <div style={{ marginTop: 15, padding: 15, background: '#e8f5e9', borderRadius: 8, maxHeight: 300, overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>📁 Результаты загрузки папки</h4>
              {folderResults.map((res, idx) => (
                <div key={idx} style={{
                  padding: '6px 10px',
                  marginBottom: 4,
                  borderRadius: 4,
                  background: res.status === 'success' ? '#d4edda' : '#f8d7da',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span>{res.status === 'success' ? '✅' : '❌'}</span>
                  <span style={{ flex: 1 }}>{res.file}</span>
                  {res.status === 'success' && res.receipt && (
                    <span style={{ color: '#155724' }}>
                      {res.receipt.store_name_ru || res.receipt.store_name || 'Чек'} — {formatAmount(res.receipt.total_amount, res.receipt.currency)}
                    </span>
                  )}
                  {res.status === 'error' && (
                    <span style={{ color: '#721c24' }}>{res.error}</span>
                  )}
                </div>
              ))}
              <button
                onClick={() => setFolderResults([])}
                style={{ marginTop: 10, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#95a5a6', color: '#fff', cursor: 'pointer' }}
              >
                Скрыть результаты
              </button>
            </div>
          )}

          <div className="controls-row">
            <div className="control-group">
              <label>Валюта:</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="auto">Auto (определить)</option>
                <option value="AED">AED (Дирхам)</option>
                <option value="EUR">EUR (Евро)</option>
                <option value="USD">USD (Доллар)</option>
                <option value="RUB">RUB (Рубль)</option>
              </select>
            </div>
            <div className="control-group">
              <label>Тип:</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}>
                <option value="receipt">Чек</option>
                <option value="invoice">Фактура</option>
              </select>
            </div>
            <div className="control-group">
              <label>Объект:</label>
              <select value={object} onChange={e => setObject(e.target.value)}>
                {OBJECTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="recognize-bar">
            <button className="recognize-main-btn" onClick={() => recognizeAndSave()} disabled={!selectedFiles.length || recognizing}>
              {recognizing ? '⏳ Распознавание...' : ' Распознать и сохранить'}
            </button>
          </div>

          {lastSavedReceipt && !scanResultOpen && (
            <div className="saved-receipt-card">
              <h3> Чек сохранён</h3>
              <div className="receipt-preview">
                {(lastSavedReceipt.photo_url || lastSavedReceipt.image_url) ? <img src={fixImageUrl(lastSavedReceipt.photo_url || lastSavedReceipt.image_url)} alt="Чек" className="receipt-image" /> : <div className="no-image-thumb" style={{width:250,height:200}}> Нет фото</div>}
                <div className="receipt-info">
                  <p><strong>ID:</strong> {lastSavedReceipt.id}</p>
                  <p><strong>Магазин:</strong> {lastSavedReceipt.store_name_ru || lastSavedReceipt.store_name || '—'}</p>
                  <p><strong>Дата:</strong> {formatDate(lastSavedReceipt.receipt_date)}</p>
                  <p><strong>Итого:</strong> {formatAmount(lastSavedReceipt.total_amount, lastSavedReceipt.currency)}</p>
                  <p><strong>Товаров:</strong> {lastSavedReceipt.items?.length || 0}</p>
                  <p><strong>Объект:</strong> {lastSavedReceipt.object || '—'}</p>
                  <p><strong>Метод:</strong> {lastSavedReceipt.recognition_method || '—'}</p>
                  <p><strong>Добавил:</strong> {formatOwnerName(lastSavedReceipt)}</p>
                  {lastSavedReceipt.warning && <p className="error">⚠️ {lastSavedReceipt.warning}</p>}
                  {lastSavedReceipt.items && lastSavedReceipt.items.length > 0 && (
                    <div className="receipt-items-preview">
                      <h4>Товары:</h4>
                      <ul>
                        {lastSavedReceipt.items.map((item, i) => (
                          <li key={i}>{item.name_ru || item.name} — {item.quantity} × {item.price} = {item.total}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lastSavedReceipt.raw_text && (
                    <details>
                      <summary>Распознанный текст</summary>
                      <pre style={{fontSize:'11px',maxHeight:200,overflow:'auto'}}>{lastSavedReceipt.raw_text}</pre>
                    </details>
                  )}
                </div>
              </div>
              <button className="close-btn" onClick={() => setLastSavedReceipt(null)}>Закрыть</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'list' && (
        <div className="list-section">
          <div className="filters" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <select value={filterType} onChange={e => {setFilterType(e.target.value); setCurrentPage(1);}}>
              <option value="all">Все типы</option>
              <option value="receipt">Чеки</option>
              <option value="invoice">Фактуры</option>
            </select>
            <select value={filterObject} onChange={e => {setFilterObject(e.target.value); setCurrentPage(1);}}>
              <option value="all">Все объекты</option>
              {OBJECTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <input type="text" placeholder="Поиск по всем полям..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} />
            <select value={itemsPerPage} onChange={e => {setItemsPerPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value)); setCurrentPage(1);}}>
              {ITEMS_PER_PAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'Все' : opt}</option>)}
            </select>
            <button onClick={() => exportExcel()}> Excel (все)</button>
            <button onClick={() => loadReceipts()}> Обновить</button>
          </div>

          {selectedReceiptIds.size > 0 && (
            <div style={{ background: '#fff3cd', padding: '12px 15px', borderRadius: 8, marginBottom: 15, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span> Выбрано: <strong>{selectedReceiptIds.size}</strong></span>
              {user?.role === 'admin' && (
                <button onClick={bulkDelete} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}> Удалить</button>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={exportMode}
                  onChange={e => setExportMode(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, background: '#fff' }}
                >
                  <option value="all">Все (Excel + Фото + Текст)</option>
                  <option value="excel"> Excel (CSV)</option>
                  <option value="photo"> Фото</option>
                  <option value="text"> Текст</option>
                </select>
                <button
                  onClick={handleExport}
                  style={{ background: '#27ae60', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                   Загрузить
                </button>
              </div>

              <button onClick={() => bulkReprocess()} style={{ background: '#9b59b6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}> Перераспознать</button>
              <select onChange={e => { if (e.target.value) bulkChangeObject(e.target.value); e.target.value = ''; }} style={{ padding: '6px 10px', borderRadius: 6 }}>
                <option value="">Сменить объект...</option>
                {OBJECTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select onChange={e => { if (e.target.value) bulkChangeCurrency(e.target.value); e.target.value = ''; }} style={{ padding: '6px 10px', borderRadius: 6 }}>
                <option value="">Сменить валюту...</option>
                <option value="AED">AED</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="RUB">RUB</option>
              </select>
              <button onClick={deselectAll} style={{ background: '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>Сбросить</button>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={{ cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" onChange={(e) => e.target.checked ? selectAllVisible() : deselectAll()} style={{ marginRight: 6 }} />
              Выбрать все на странице
            </label>
          </div>

          {loading ? (
            <div className="loading-center"><div className="spinner"></div><p>Загрузка чеков...</p></div>
          ) : paginatedReceipts.length === 0 ? (
            <p className="empty-state">Нет чеков. Загрузите первый!</p>
          ) : (
            <>
              <div className="receipts-grid">
                {paginatedReceipts.map(receipt => {
                  const itemsTotal = calculateItemsTotal(receipt.items);
                  const total = parseFloat(receipt.total_amount) || 0;
                  const diff = Math.abs(total - itemsTotal).toFixed(2);
                  const hasDiff = diff > 0.01;

                  return (
                    <div key={receipt.id} className="receipt-card">
                      <div className="receipt-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingTop: 2 }}>
                        <input type="checkbox" checked={selectedReceiptIds.has(receipt.id)} onChange={() => toggleSelect(receipt.id)} style={{ width: 20, height: 20, cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                        <h3 style={{ margin: 0, flex: 1, lineHeight: 1.3 }}>
                          <HighlightText text={receipt.store_name_ru || receipt.store_name || 'Без названия'} query={searchQuery} />
                        </h3>
                        <span className="type-badge" style={{ flexShrink: 0 }}>{receipt.document_type}</span>
                      </div>
                      <p className="date">{formatDate(receipt.receipt_date)} {receipt.receipt_time}</p>
                      <p className="amount" style={{ color: hasDiff ? '#e67e22' : '#27ae60' }}>
                        {formatAmount(receipt.total_amount, receipt.currency)}
                        {hasDiff && <span style={{ fontSize: 12, color: '#e74c3c', marginLeft: 6 }}>(Δ {diff})</span>}
                      </p>
                      <p className="items-count"> {receipt.items?.length || 0} товаров</p>
                      {receipt.object && (
                        <p style={{ fontSize: 12, color: '#7f8c8d', margin: '4px 0' }}>
                          <HighlightText text={receipt.object} query={searchQuery} />
                        </p>
                      )}
                      <p style={{ fontSize: 12, color: '#3498db', margin: '4px 0', fontWeight: 500 }}>
                        <HighlightText text={formatOwnerName(receipt)} query={searchQuery} />
                      </p>
                      {(receipt.photo_url || receipt.image_url) ? (
                        <img src={fixImageUrl(receipt.photo_url || receipt.image_url)} alt="Чек" className="receipt-thumb" onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="no-image-thumb"> Чек</div>
                      )}
                      <div className="receipt-actions">
                        <button onClick={() => setViewModal(receipt)}> Просмотр</button>
                        {user?.role === 'admin' && (
                          <button onClick={() => deleteReceipt(receipt.id)} className="danger"> Удалить</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {itemsPerPage !== 'all' && totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: currentPage === 1 ? '#ddd' : '#3498db', color: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>◀ Назад</button>
                  <span>Страница {currentPage} из {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: currentPage === totalPages ? '#ddd' : '#3498db', color: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>Вперёд ▶</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {scanResultOpen && (
        <div className="scan-overlay">
          <div className="scan-overlay-header">
            <strong style={{ fontSize: 17 }}>{recognizing ? '⏳ Распознаю чек…' : '✅ Распознанный чек'}</strong>
            <button onClick={finishScan}>✕ Выход</button>
          </div>

          <div className="scan-overlay-body">
            {recognizing && (
              <div style={{ textAlign: 'center', marginTop: 40, fontSize: 16, opacity: 0.9 }}>
                Обрабатываю снимок и распознаю текст…
              </div>
            )}

            {!recognizing && lastSavedReceipt && (
              <div>
                {((lastSavedReceipt.photo_url || lastSavedReceipt.image_url) || previewUrl) && (
                  <img src={fixImageUrl(lastSavedReceipt.photo_url || lastSavedReceipt.image_url) || previewUrl} alt="Чек" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12, background: '#000', marginBottom: 14 }} />
                )}
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, lineHeight: 1.6 }}>
                  <div><strong>Магазин:</strong> {lastSavedReceipt.store_name_ru || lastSavedReceipt.store_name || '—'}</div>
                  <div><strong>Дата:</strong> {formatDate(lastSavedReceipt.receipt_date)}</div>
                  <div><strong>Итого:</strong> {formatAmount(lastSavedReceipt.total_amount, lastSavedReceipt.currency)}</div>
                  <div><strong>Товаров:</strong> {lastSavedReceipt.items?.length || 0}</div>
                  <div><strong>Объект:</strong> {lastSavedReceipt.object || '—'}</div>
                  {lastSavedReceipt.warning && <div style={{ color: '#fca5a5' }}>⚠️ {lastSavedReceipt.warning}</div>}
                </div>

                {lastSavedReceipt.items && lastSavedReceipt.items.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Товары:</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {lastSavedReceipt.items.map((item, i) => (
                        <li key={i} style={{ fontSize: 14, opacity: 0.95 }}>{item.name_ru || item.name} — {item.quantity} × {item.price} = {item.total}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {lastSavedReceipt.raw_text && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Распознанный текст:</div>
                    <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.35)', padding: 12, borderRadius: 10, maxHeight: 220, overflow: 'auto' }}>{lastSavedReceipt.raw_text}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {!recognizing && lastSavedReceipt && (
            <div className="scan-overlay-footer">
              <button onClick={finishScan}>✅ Сохранить</button>
              <button onClick={rescanScan}>🔄 Переснять</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
