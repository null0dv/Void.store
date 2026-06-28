const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const productStore = require('./lib/product-store');

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

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(siteConfigFile)) {
  fs.writeFileSync(siteConfigFile, JSON.stringify({ publicUrl: null }, null, 2), 'utf-8');
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

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, Date.now());
  return token;
}

function isValidAdminSession(token) {
  if (!token || !adminSessions.has(token)) return false;
  const created = adminSessions.get(token);
  if (Date.now() - created > SESSION_MAX_AGE) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req).admin_token;
  if (isValidAdminSession(token)) return next();
  res.status(401).json({ error: '需要管理員權限' });
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
  });
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
  const token = parseCookies(req).admin_token;
  res.json({ isAdmin: isValidAdminSession(token) });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || !verifyPassword(password)) {
    return res.status(401).json({ error: '密碼錯誤' });
  }

  const token = createAdminSession();
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
  });
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  const token = parseCookies(req).admin_token;
  if (token) adminSessions.delete(token);
  res.clearCookie('admin_token');
  res.json({ success: true });
});

app.post('/api/products', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description, price, category } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: '商品名稱與價格為必填' });
  }

  try {
    const product = await productStore.createProduct(
      { name, description, price, category },
      req.file || null,
    );
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message || '上架失敗' });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
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