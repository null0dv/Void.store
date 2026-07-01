const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const dataFile = path.join(dataDir, 'products.json');
const PRODUCTS_OBJECT = 'products.json';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

let supabase = null;

function usesSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function usesPersistentStorage() {
  return usesSupabase() || process.env.NODE_ENV !== 'production';
}

function getSupabase() {
  if (!usesSupabase()) return null;
  if (!supabase) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

function ensureLocalDirs() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8');
}

function formatCreatedAt(value) {
  if (!value) {
    return new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  }
  if (typeof value === 'string' && value.includes('/')) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

const STOCK_TYPES = new Set(['AI製', '現貨']);

function normalizeStockType(value) {
  return STOCK_TYPES.has(value) ? value : '現貨';
}

function normalizeSold(value) {
  return value === true || value === 'true' || value === 'on' || value === '1' || value === 1;
}

function normalizeSortOrder(value, fallbackId) {
  const num = Number(value);
  return Number.isFinite(num) ? num : Number(fallbackId) || 0;
}

function compareProducts(a, b) {
  const ao = normalizeSortOrder(a.sort_order, a.id);
  const bo = normalizeSortOrder(b.sort_order, b.id);
  if (ao !== bo) return ao - bo;
  return Number(b.id) - Number(a.id);
}

function sortProductList(products) {
  return [...products].sort(compareProducts);
}

function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    category: row.category || '其他',
    stock_type: normalizeStockType(row.stock_type),
    series: row.series || 'nullcraft',
    sold: normalizeSold(row.sold),
    sort_order: normalizeSortOrder(row.sort_order, row.id),
    image: row.image || null,
    created_at: formatCreatedAt(row.created_at),
  };
}

function readLocalProducts() {
  ensureLocalDirs();
  return JSON.parse(fs.readFileSync(dataFile, 'utf-8')).map(normalizeProduct);
}

function writeLocalProducts(products) {
  ensureLocalDirs();
  fs.writeFileSync(dataFile, JSON.stringify(products, null, 2), 'utf-8');
}

async function ensureSupabaseBucket(client) {
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw new Error(error.message);
  if ((buckets || []).some(bucket => bucket.name === BUCKET)) return;

  const { error: createError } = await client.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (createError) throw new Error(createError.message);
}

async function readSupabaseProducts() {
  const client = getSupabase();
  await ensureSupabaseBucket(client);

  const { data, error } = await client.storage.from(BUCKET).download(PRODUCTS_OBJECT);
  if (error) {
    const missing =
      error.message?.toLowerCase().includes('not found') ||
      error.message?.toLowerCase().includes('object not found') ||
      error.statusCode === 404;
    if (missing) {
      await writeSupabaseProducts([]);
      return [];
    }
    throw new Error(error.message);
  }

  const text = await data.text();
  if (!text.trim()) return [];
  return JSON.parse(text).map(normalizeProduct);
}

async function writeSupabaseProducts(products) {
  const client = getSupabase();
  await ensureSupabaseBucket(client);

  const payload = Buffer.from(JSON.stringify(products, null, 2), 'utf-8');
  const { error } = await client.storage.from(BUCKET).upload(PRODUCTS_OBJECT, payload, {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '0',
  });
  if (error) throw new Error(error.message);
}

async function listProducts() {
  if (!usesSupabase()) {
    return sortProductList(readLocalProducts());
  }

  const products = await readSupabaseProducts();
  return sortProductList(products);
}

async function uploadImage(file) {
  if (!file) return null;

  if (!usesSupabase()) {
    ensureLocalDirs();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = unique + path.extname(file.originalname);
    const target = path.join(uploadsDir, filename);
    fs.writeFileSync(target, file.buffer);
    return `/uploads/${filename}`;
  }

  const client = getSupabase();
  await ensureSupabaseBucket(client);
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const objectPath = `images/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

function getStorageObjectPath(imageUrl) {
  if (!imageUrl || !imageUrl.includes(`/storage/v1/object/public/${BUCKET}/`)) return null;
  return imageUrl.split(`/storage/v1/object/public/${BUCKET}/`)[1] || null;
}

async function createProduct({ name, description, price, category, stock_type, series, sold }, file) {
  if (!usesSupabase()) {
    const products = readLocalProducts();
    const image = await uploadImage(file);
    const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const maxOrder = products.reduce(
      (max, item) => Math.max(max, normalizeSortOrder(item.sort_order, item.id)),
      -1,
    );
    const product = normalizeProduct({
      id: nextId,
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || '其他',
      stock_type: normalizeStockType(stock_type),
      series: series || 'nullcraft',
      sold: normalizeSold(sold),
      sort_order: maxOrder + 1,
      image,
      created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
    });
    products.push(product);
    writeLocalProducts(products);
    return product;
  }

  const products = await readSupabaseProducts();
  const image = await uploadImage(file);
  const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
  const maxOrder = products.reduce(
    (max, item) => Math.max(max, normalizeSortOrder(item.sort_order, item.id)),
    -1,
  );
  const product = normalizeProduct({
    id: nextId,
    name,
    description: description || '',
    price: parseFloat(price),
    category: category || '其他',
    stock_type: normalizeStockType(stock_type),
    series: series || 'nullcraft',
    sold: normalizeSold(sold),
    sort_order: maxOrder + 1,
    image,
    created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
  });
  products.push(product);
  await writeSupabaseProducts(products);
  return product;
}

async function removeProductImage(imageUrl) {
  if (!imageUrl) return;

  if (!usesSupabase()) {
    if (imageUrl.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '..', imageUrl);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }
    return;
  }

  const objectPath = getStorageObjectPath(imageUrl);
  if (objectPath) {
    const client = getSupabase();
    await client.storage.from(BUCKET).remove([objectPath]);
  }
}

async function deleteProduct(id) {
  if (!usesSupabase()) {
    const products = readLocalProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return false;

    const product = products[index];
    await removeProductImage(product.image);

    products.splice(index, 1);
    writeLocalProducts(products);
    return true;
  }

  const products = await readSupabaseProducts();
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return false;

  const product = products[index];
  await removeProductImage(product.image);

  products.splice(index, 1);
  await writeSupabaseProducts(products);
  return true;
}

async function updateProduct(id, { name, description, price, category, stock_type, series, sold }, file) {
  if (!usesSupabase()) {
    const products = readLocalProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return null;

    const existing = products[index];
    let image = existing.image;

    if (file) {
      const newImage = await uploadImage(file);
      if (newImage) {
        await removeProductImage(existing.image);
        image = newImage;
      }
    }

    const updated = normalizeProduct({
      ...existing,
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || '其他',
      stock_type: normalizeStockType(stock_type),
      series: series || existing.series || 'nullcraft',
      sold: sold === undefined ? existing.sold : normalizeSold(sold),
      image,
    });

    products[index] = updated;
    writeLocalProducts(products);
    return updated;
  }

  const products = await readSupabaseProducts();
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return null;

  const existing = products[index];
  let image = existing.image;

  if (file) {
    const newImage = await uploadImage(file);
    if (newImage) {
      await removeProductImage(existing.image);
      image = newImage;
    }
  }

  const updated = normalizeProduct({
    ...existing,
    name,
    description: description || '',
    price: parseFloat(price),
    category: category || '其他',
    stock_type: normalizeStockType(stock_type),
    series: series || existing.series || 'nullcraft',
    sold: sold === undefined ? existing.sold : normalizeSold(sold),
    image,
  });

  products[index] = updated;
  await writeSupabaseProducts(products);
  return updated;
}

async function reorderProducts(orderIds) {
  const ids = (orderIds || [])
    .map(id => parseInt(id, 10))
    .filter(id => Number.isFinite(id));

  if (!usesSupabase()) {
    const products = readLocalProducts();
    const map = new Map(products.map(product => [product.id, product]));
    let index = 0;

    ids.forEach(id => {
      if (!map.has(id)) return;
      map.get(id).sort_order = index;
      index += 1;
    });

    products.forEach(product => {
      if (!ids.includes(product.id)) {
        product.sort_order = index;
        index += 1;
      }
    });

    const normalized = products.map(normalizeProduct);
    writeLocalProducts(normalized);
    return sortProductList(normalized);
  }

  const products = await readSupabaseProducts();
  const map = new Map(products.map(product => [product.id, product]));
  let index = 0;

  ids.forEach(id => {
    if (!map.has(id)) return;
    map.get(id).sort_order = index;
    index += 1;
  });

  products.forEach(product => {
    if (!ids.includes(product.id)) {
      product.sort_order = index;
      index += 1;
    }
  });

  const normalized = products.map(normalizeProduct);
  await writeSupabaseProducts(normalized);
  return sortProductList(normalized);
}

async function setProductSold(id, sold) {
  if (!usesSupabase()) {
    const products = readLocalProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return null;

    const updated = normalizeProduct({
      ...products[index],
      sold: normalizeSold(sold),
    });
    products[index] = updated;
    writeLocalProducts(products);
    return updated;
  }

  const products = await readSupabaseProducts();
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return null;

  const updated = normalizeProduct({
    ...products[index],
    sold: normalizeSold(sold),
  });
  products[index] = updated;
  await writeSupabaseProducts(products);
  return updated;
}

module.exports = {
  usesSupabase,
  usesPersistentStorage,
  listProducts,
  createProduct,
  updateProduct,
  reorderProducts,
  setProductSold,
  deleteProduct,
};