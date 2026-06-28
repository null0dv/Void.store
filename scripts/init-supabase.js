const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const schemaFile = path.join(__dirname, '..', 'supabase-schema.sql');

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(listError.message);

  if ((buckets || []).some(bucket => bucket.name === 'product-images')) {
    console.log('bucket: exists');
    return;
  }

  const { error } = await client.storage.createBucket('product-images', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });

  if (error) throw new Error(error.message);
  console.log('bucket: created');
}

async function ensureProductsTable(client) {
  const { error } = await client.from('products').select('id').limit(1);
  if (!error) {
    console.log('products_table: exists');
    return;
  }

  if (!error.message.includes('Could not find the table')) {
    throw new Error(error.message);
  }

  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  if (!dbPassword) {
    console.log('products_table: missing');
    console.log('ACTION: Run supabase-schema.sql in Supabase SQL Editor');
    console.log('SQL_EDITOR: https://supabase.com/dashboard/project/iriuznaoxstqsepisldd/sql/new');
    return false;
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.log('products_table: missing (install pg or run SQL manually)');
    return false;
  }

  const ref = url.replace('https://', '').replace('.supabase.co', '');
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(schemaFile, 'utf-8');
  await pool.query(sql);
  await pool.end();
  console.log('products_table: created');
  return true;
}

async function main() {
  if (!url || !key) {
    console.error('Missing Supabase URL or secret key');
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureBucket(client);
  const tableReady = await ensureProductsTable(client);
  if (!tableReady) process.exit(2);
  console.log('READY');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(99);
});