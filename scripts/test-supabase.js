const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

async function main() {
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.from('products').select('id').limit(1);
  if (error) {
    console.error('TABLE_ERROR:', error.message);
    process.exit(2);
  }

  const { data: buckets, error: bucketError } = await client.storage.listBuckets();
  if (bucketError) {
    console.error('BUCKET_ERROR:', bucketError.message);
    process.exit(3);
  }

  const hasBucket = (buckets || []).some(b => b.name === 'product-images');
  console.log('OK');
  console.log('products_table: yes');
  console.log('product-images_bucket:', hasBucket ? 'yes' : 'no');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(99);
});