const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
const MEMBER_SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'products.json');
const membersFile = path.join(dataDir, 'members.json');
const adminConfigFile = path.join(dataDir, 'admin-config.json');
const siteConfigFile = path.join(dataDir, 'site-config.json');
const googleConfigFile = path.join(dataDir, 'google-config.json');

const adminSessions = new Map();
const memberSessions = new Map();

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8');
if (!fs.existsSync(membersFile)) fs.writeFileSync(membersFile, '[]', 'utf-8');
if (!fs.existsSync(siteConfigFile)) fs.writeFileSync(siteConfigFile, JSON.stringify({ publicUrl: null }, null, 2), 'utf-8');
if (!fs.existsSync(googleConfigFile)) fs.writeFileSync(googleConfigFile, JSON.stringify({ clientId: '' }, null, 2), 'utf-8');

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

function readGoogleConfig() {
  const config = JSON.parse(fs.readFileSync(googleConfigFile, 'utf-8'));
  if (process.env.GOOGLE_CLIENT_ID) config.clientId = process.env.GOOGLE_CLIENT_ID;
  return config;
}

function readMembers() {
  return JSON.parse(fs.readFileSync(membersFile, 'utf-8'));
}

function writeMembers(members) {
  fs.writeFileSync(membersFile, JSON.stringify(members, null, 2), 'utf-8');
}

function upsertMember({ email, name, picture, googleId }) {
  const members = readMembers();
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const index = members.findIndex(m => m.email === email);

  if (index === -1) {
    members.push({ email, name, picture, googleId, firstLogin: now, lastLogin: now });
  } else {
    members[index] = { ...members[index], name, picture, googleId, lastLogin: now };
  }

  writeMembers(members);
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

function createMemberSession(member) {
  const token = crypto.randomBytes(32).toString('hex');
  memberSessions.set(token, { ...member, createdAt: Date.now() });
  return token;
}

function getMemberSession(token) {
  if (!token || !memberSessions.has(token)) return null;
  const session = memberSessions.get(token);
  if (Date.now() - session.createdAt > MEMBER_SESSION_MAX_AGE) {
    memberSessions.delete(token);
    return null;
  }
  return session;
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req).admin_token;
  if (isValidAdminSession(token)) return next();
  res.status(401).json({ error: '需要管理員權限' });
}

function readProducts() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
}

function writeProducts(products) {
  fs.writeFileSync(dataFile, JSON.stringify(products, null, 2), 'utf-8');
}

initAdminConfig();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: IS_PRODUCTION ? 'production' : 'development' });
});

app.get('/api/config', (req, res) => {
  const site = readSiteConfig();
  const google = readGoogleConfig();
  const publicUrl = site.publicUrl || (req.protocol + '://' + req.get('host'));
  res.json({
    publicUrl,
    googleClientId: google.clientId || null,
    isProduction: IS_PRODUCTION,
  });
});

app.get('/api/products', (req, res) => {
  const products = readProducts().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(products);
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

app.get('/api/member/status', (req, res) => {
  const member = getMemberSession(parseCookies(req).member_token);
  if (!member) return res.json({ isLoggedIn: false });
  res.json({
    isLoggedIn: true,
    member: { email: member.email, name: member.name, picture: member.picture },
  });
});

app.post('/api/member/google', async (req, res) => {
  const { credential } = req.body;
  const googleConfig = readGoogleConfig();

  if (!googleConfig.clientId) {
    return res.status(503).json({ error: 'Google 登入尚未設定，請填入 Client ID' });
  }
  if (!credential) {
    return res.status(400).json({ error: '缺少登入憑證' });
  }

  try {
    const client = new OAuth2Client(googleConfig.clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleConfig.clientId,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name || email;
    const picture = payload.picture || null;
    const googleId = payload.sub;

    if (!email) return res.status(400).json({ error: '無法取得 Email' });

    upsertMember({ email, name, picture, googleId });

    const token = createMemberSession({ email, name, picture, googleId });
    res.cookie('member_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: MEMBER_SESSION_MAX_AGE,
    });

    res.json({ success: true, member: { email, name, picture } });
  } catch {
    res.status(401).json({ error: 'Google 登入驗證失敗' });
  }
});

app.post('/api/member/logout', (req, res) => {
  const token = parseCookies(req).member_token;
  if (token) memberSessions.delete(token);
  res.clearCookie('member_token');
  res.json({ success: true });
});

app.post('/api/products', requireAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, category } = req.body;

  if (!name || !price) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: '商品名稱與價格為必填' });
  }

  const products = readProducts();
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  const product = {
    id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
    name,
    description: description || '',
    price: parseFloat(price),
    category: category || '其他',
    image,
    created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
  };

  products.push(product);
  writeProducts(products);
  res.status(201).json(product);
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const products = readProducts();
  const index = products.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: '找不到商品' });

  const product = products[index];
  if (product.image) {
    const imagePath = path.join(__dirname, product.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }

  products.splice(index, 1);
  writeProducts(products);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  const publicUrl = getPublicUrl();
  console.log(`商品上傳網站已啟動：http://localhost:${PORT}`);
  if (publicUrl) console.log(`公開網址：${publicUrl}`);
  const google = readGoogleConfig();
  if (!google.clientId) {
    console.log('提示：設定 GOOGLE_CLIENT_ID 環境變數以啟用會員登入');
  }
});