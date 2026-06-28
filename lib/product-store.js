const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const dataFile = path.join(dataDir, 'products.json');

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

function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    category: row.category || '其他',
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

async function listProducts() {
  if (!usesSupabase()) {
    return readLocalProducts().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const client = getSupabase();
  const { data, error } = await client
    .from('products')
    .select('*')
    .order('id', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(normalizeProduct);
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
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const objectPath = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function createProduct({ name, description, price, category }, file) {
  if (!usesSupabase()) {
    const products = readLocalProducts();
    const image = await uploadImage(file);
    const product = normalizeProduct({
      id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || '其他',
      image,
      created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
    });
    products.push(product);
    writeLocalProducts(products);
    return product;
  }

  const client = getSupabase();
  const image = await uploadImage(file);
  const { data, error } = await client
    .from('products')
    .insert({
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || '其他',
      image,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return normalizeProduct(data);
}

async function deleteProduct(id) {
  if (!usesSupabase()) {
    const products = readLocalProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return false;

    const product = products[index];
    if (product.image && product.image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '..', product.image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    products.splice(index, 1);
    writeLocalProducts(products);
    return true;
  }

  const client = getSupabase();
  const { data: existing, error: readError } = await client
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) return false;

  if (existing.image && existing.image.includes(`/storage/v1/object/public/${BUCKET}/`)) {
    const objectPath = existing.image.split(`/storage/v1/object/public/${BUCKET}/`)[1];
    if (objectPath) {
      await client.storage.from(BUCKET).remove([objectPath]);
    }
  }

  const { error } = await client.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

module.exports = {
  usesSupabase,
  usesPersistentStorage,
  listProducts,
  createProduct,
  deleteProduct,
};