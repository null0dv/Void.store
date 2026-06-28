const productStore = require('../lib/product-store');

async function main() {
  if (!productStore.usesSupabase()) {
    console.error('Supabase env vars missing');
    process.exit(1);
  }

  const products = await productStore.listProducts();
  console.log('READY');
  console.log(`products_count: ${products.length}`);
  console.log(`persistent: ${productStore.usesPersistentStorage()}`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(99);
});