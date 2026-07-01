const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const productStore = require('./lib/product-store');
const categoryStore = require('./lib/categories');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
const adminConfigFile = path.join(dataDir, 'admin-config.json');
const siteConfigFile = path.join(dataDir, 'site-config.json');

const adminSessions = new Map();
const SUBUSER_ONANDON_PASSWORD = process.env.SUBUSER_ONANDON_PASSWORD || 'ONANDON777';

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(siteConfigFile)) {
  fs.writeFileSync(siteConfigFile, JSON.stringify({
    publicUrl: null,
    lineInquiryUrl: null,
    lineGroupUrl: null,
    customCategories: [],
  }, null, 2), 'utf-8');
}

function getPublicUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}

function readSiteConfig() {
  const config = JSON.parse(fs.readFileSync(siteConfigFile, 'utf-8'));
  const publicUrl = getPublicUrl();
  if (publicUrl) config.publicUrl = publicUrl;
  if (process.env.LINE_INQUIRY_URL) config.lineInquiryUrl = process.env.LINE_INQUIRY_URL;
  if (process.env.LINE_GROUP_URL) config.lineGroupUrl = process.env.LINE_GROUP_URL;
  return config;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function initAdminConfig() {
  const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (!fs.existsSync(adminConfigFile)) {
    const salt = crypto.randomBytes(16).toString('hex');
    const config = { salt, hash: hashPassword(defaultPassword, salt) };
    fs.writeFileSync(adminConfigFile, JSON.stringify(config, null, 2), 'utf-8');
    if (!process.env.ADMIN_PASSWORD) {
      console.log('管理員預設密碼：admin123（正式環境請設定 ADMIN_PASSWORD）');
    }
  } else if (process.env.ADMIN_PASSWORD) {
    const salt = crypto.randomBytes(16).toString('hex');
    const config = { salt, hash: hashPassword(process.env.ADMIN_PASSWORD, salt) };
    fs.writeFileSync(adminConfigFile, JSON.stringify(config, null, 2), 'utf-8');
  }
}

function verifyPassword(password) {
  const config = JSON.parse(fs.readFileSync(adminConfigFile, 'utf-8'));
  const testHash = hashPassword(password, config.salt);
  return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(config.hash));
}

function setAdminPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const config = { salt, hash: hashPassword(password, salt) };
  fs.writeFileSync(adminConfigFile, JSON.stringify(config, null, 2), 'utf-8');
}

function changeAdminPassword(currentPassword, newPassword) {
  if (!currentPassword || !verifyPassword(currentPassword)) {
    return { ok: false, error: '目前密碼錯誤' };
  }
  if (!newPassword || String(newPassword).length < 4) {
    return { ok: false, error: '新密碼至少 4 個字元' };
  }
  setAdminPassword(newPassword);
  return { ok: true };
}

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function createSession(role, username = null) {
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, { created: Date.now(), role, username });
  return token;
}

function getSession(token) {
  if (!token || !adminSessions.has(token)) return null;
  const session = adminSessions.get(token);
  if (typeof session === 'number') {
    adminSessions.set(token, { created: session, role: 'admin', username: null });
    return adminSessions.get(token);
  }
  if (Date.now() - session.created > SESSION_MAX_AGE) {
    adminSessions.delete(token);
    return null;
  }
  return session;
}

function isValidAdminSession(token) {
  return getSession(token)?.role === 'admin';
}

function setSessionCookie(res, token) {
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
  });
}

function requireAdmin(req, res, next) {
  const session = getSession(parseCookies(req).admin_token);
  if (session?.role === 'admin') {
    req.userSession = session;
    return next();
  }
  res.status(401).json({ error: '需要管理員權限' });
}

function requireAuth(req, res, next) {
  const session = getSession(parseCookies(req).admin_token);
  if (session?.role === 'admin' || session?.role === 'onandon') {
    req.userSession = session;
    return next();
  }
  res.status(401).json({ error: '需要登入' });
}

function canEditProduct(session, product) {
  if (!session || !product) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'onandon') return product.uploaded_by === 'onandon';
  return false;
}

async function findProductById(id) {
  const products = await productStore.listProducts();
  return products.find(product => product.id === id) || null;
}

initAdminConfig();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: IS_PRODUCTION ? 'production' : 'development' });
});

app.get('/api/config', (req, res) => {
  const site = readSiteConfig();
  const publicUrl = site.publicUrl || `${req.protocol}://${req.get('host')}`;
  res.json({
    publicUrl,
    isProduction: IS_PRODUCTION,
    persistentStorage: productStore.usesPersistentStorage(),
    storageBackend: productStore.usesSupabase() ? 'supabase' : 'local',
    lineInquiryUrl: site.lineInquiryUrl || null,
    lineGroupUrl: site.lineGroupUrl || null,
    categories: categoryStore.getCategories(),
  });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const result = categoryStore.addCustomCategory(req.body?.name);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, categories: result.categories });
});

app.put('/api/products/reorder', requireAdmin, async (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error: '請提供商品排序' });
  }

  try {
    const products = await productStore.reorderProducts(order);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: err.message || '排序失敗' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await productStore.listProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message || '讀取商品失敗' });
  }
});

app.get('/api/admin/status', (req, res) => {
  const session = getSession(parseCookies(req).admin_token);
  res.json({
    isAdmin: session?.role === 'admin',
    isSubUser: session?.role === 'onandon',
    role: session?.role || null,
    username: session?.username || null,
  });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || !verifyPassword(password)) {
    return res.status(401).json({ error: '密碼錯誤' });
  }

  const token = createSession('admin');
  setSessionCookie(res, token);
  res.json({ success: true, role: 'admin' });
});

app.post('/api/subuser/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== SUBUSER_ONANDON_PASSWORD) {
    return res.status(401).json({ error: '密碼錯誤' });
  }

  const token = createSession('onandon', 'ON AND ON');
  setSessionCookie(res, token);
  res.json({ success: true, role: 'onandon', username: 'ON AND ON' });
});

app.post('/api/admin/logout', (req, res) => {
  const token = parseCookies(req).admin_token;
  if (token) adminSessions.delete(token);
  res.clearCookie('admin_token');
  res.json({ success: true });
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const result = changeAdminPassword(currentPassword, newPassword);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  const token = parseCookies(req).admin_token;
  if (token) adminSessions.delete(token);
  res.clearCookie('admin_token');
  res.json({ success: true, reauth: true });
});

app.post('/api/products', requireAuth, upload.single('image'), async (req, res) => {
  const { name, description, price, category, stock_type, series } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: '商品名稱與價格為必填' });
  }

  try {
    const uploaded_by = req.userSession.role === 'onandon' ? 'onandon' : 'admin';
    const product = await productStore.createProduct(
      { name, description, price, category, stock_type, series, uploaded_by },
      req.file || null,
    );
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message || '上架失敗' });
  }
});

app.put('/api/products/:id', requireAuth, upload.single('image'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, price, category, stock_type, series, sold } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: '商品名稱與價格為必填' });
  }

  try {
    const existing = await findProductById(id);
    if (!existing) return res.status(404).json({ error: '找不到商品' });
    if (!canEditProduct(req.userSession, existing)) {
      return res.status(403).json({ error: '僅能編輯自己上傳的商品' });
    }

    const product = await productStore.updateProduct(
      id,
      { name, description, price, category, stock_type, series, sold },
      req.file || null,
    );
    if (!product) return res.status(404).json({ error: '找不到商品' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message || '更新失敗' });
  }
});

app.patch('/api/products/:id/sold', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sold = req.body.sold === true || req.body.sold === 'true';

  try {
    const existing = await findProductById(id);
    if (!existing) return res.status(404).json({ error: '找不到商品' });
    if (!canEditProduct(req.userSession, existing)) {
      return res.status(403).json({ error: '僅能編輯自己上傳的商品' });
    }

    const product = await productStore.setProductSold(id, sold);
    if (!product) return res.status(404).json({ error: '找不到商品' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message || '更新售出狀態失敗' });
  }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const existing = await findProductById(id);
    if (!existing) return res.status(404).json({ error: '找不到商品' });
    if (!canEditProduct(req.userSession, existing)) {
      return res.status(403).json({ error: '僅能編輯自己上傳的商品' });
    }

    const deleted = await productStore.deleteProduct(id);
    if (!deleted) return res.status(404).json({ error: '找不到商品' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '刪除失敗' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const publicUrl = getPublicUrl();
  console.log(`商品上傳網站已啟動：http://localhost:${PORT}`);
  if (publicUrl) console.log(`公開網址：${publicUrl}`);
  if (IS_PRODUCTION && !productStore.usesSupabase()) {
    console.log('警告：未設定 Supabase，雲端商品會在重新部署或休眠後消失');
  } else if (productStore.usesSupabase()) {
    console.log('商品儲存：Supabase（持久化）');
  }
});