const productStore = require('../lib/product-store');

async function main() {
  const product = await productStore.createProduct(
    { name: 'Supabase Test', description: 'auto setup', price: 100, category: '其他' },
    null,
  );
  const products = await productStore.listProducts();
  console.log('created:', product.id, product.name);
  console.log('total:', products.length);
  await productStore.deleteProduct(product.id);
  console.log('cleanup: ok');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(99);
});