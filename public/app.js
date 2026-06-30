let isAdmin = false;
let allProducts = [];
let currentLightboxId = null;
let editingProductId = null;
let publicBaseUrl = null;
let persistentStorage = true;
let lineGroupUrl = null;

const CART_KEY = 'void-store-cart';
const HISTORY_KEY = 'void-store-history';
const MAX_HISTORY = 12;
const GALLERY_SERIES = ['nullcraft', '二手選品', '礦石'];
const DEFAULT_CATEGORIES = [
  '銀飾', '墜飾', '耳環', '戒指', 'AI畫作',
  '服飾', '食品', '3C電子', '居家生活', '美妝保養', '其他',
];

let activeSeriesFilter = 'all';
let randomBrowseMode = false;
let allCategories = [...DEFAULT_CATEGORIES];

const form = document.getElementById('uploadForm');
const imageInput = document.getElementById('image');
const dropZone = document.getElementById('dropZone');
const dropContent = document.getElementById('dropContent');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const productsGrid = document.getElementById('productsGrid');
const productCount = document.getElementById('productCount');
const modeLabel = document.getElementById('modeLabel');
const submitBtn = document.getElementById('submitBtn');
const toast = document.getElementById('toast');
const uploadSection = document.getElementById('uploadSection');
const loginBtn = document.getElementById('loginBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const cartBtn = document.getElementById('cartBtn');
const cartBadge = document.getElementById('cartBadge');
const cartDrawerBg = document.getElementById('cartDrawerBg');
const cartDrawer = document.getElementById('cartDrawer');
const cartList = document.getElementById('cartList');
const cartFooter = document.getElementById('cartFooter');
const cartTotal = document.getElementById('cartTotal');
const closeCartBtn = document.getElementById('closeCartBtn');
const clearCartBtn = document.getElementById('clearCartBtn');
const copyCartBtn = document.getElementById('copyCartBtn');
const recentSection = document.getElementById('recentSection');
const recentGrid = document.getElementById('recentGrid');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const passwordModal = document.getElementById('passwordModal');
const passwordForm = document.getElementById('passwordForm');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');
const cancelPassword = document.getElementById('cancelPassword');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const adminPassword = document.getElementById('adminPassword');
const cancelLogin = document.getElementById('cancelLogin');
const subtitle = document.getElementById('subtitle');
const imageLightbox = document.getElementById('imageLightbox');
const closeLightboxBtn = document.getElementById('closeLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxPlaceholder = document.getElementById('lightboxPlaceholder');
const lightboxCategory = document.getElementById('lightboxCategory');
const lightboxStockType = document.getElementById('lightboxStockType');
const lightboxSoldBadge = document.getElementById('lightboxSoldBadge');
const lightboxSoldBtn = document.getElementById('lightboxSoldBtn');
const lightboxName = document.getElementById('lightboxName');
const lightboxDesc = document.getElementById('lightboxDesc');
const lightboxPrice = document.getElementById('lightboxPrice');
const lightboxGuestActions = document.getElementById('lightboxGuestActions');
const lightboxAdminActions = document.getElementById('lightboxAdminActions');
const lightboxCartBtn = document.getElementById('lightboxCartBtn');
const lightboxShareBtn = document.getElementById('lightboxShareBtn');
const lightboxEditBtn = document.getElementById('lightboxEditBtn');
const lightboxDeleteBtn = document.getElementById('lightboxDeleteBtn');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editId = document.getElementById('editId');
const editName = document.getElementById('editName');
const editPrice = document.getElementById('editPrice');
const editCategory = document.getElementById('editCategory');
const editSeries = document.getElementById('editSeries');
const editStockType = document.getElementById('editStockType');
const editSold = document.getElementById('editSold');
const editDescription = document.getElementById('editDescription');
const editImageInput = document.getElementById('editImage');
const editDropZone = document.getElementById('editDropZone');
const editDropContent = document.getElementById('editDropContent');
const editPreview = document.getElementById('editPreview');
const editPreviewImg = document.getElementById('editPreviewImg');
const editRemoveImageBtn = document.getElementById('editRemoveImage');
const editCurrentImgWrap = document.getElementById('editCurrentImgWrap');
const editCurrentImg = document.getElementById('editCurrentImg');
const editDeleteBtn = document.getElementById('editDeleteBtn');
const cancelEdit = document.getElementById('cancelEdit');
const editSubmitBtn = document.getElementById('editSubmitBtn');
const publicUrlLabel = document.getElementById('publicUrlLabel');
const lineGroupBtn = document.getElementById('lineGroupBtn');
const eventSlotBtn = document.getElementById('eventSlotBtn');
const filterTags = document.getElementById('filterTags');
const randomBrowseBtn = document.getElementById('randomBrowseBtn');
const randomBrowseIndicator = document.getElementById('randomBrowseIndicator');
const physicsHint = document.querySelector('.physics-hint');
const categorySelect = document.getElementById('category');
const categoryAddRow = document.getElementById('categoryAddRow');
const categoryNew = document.getElementById('categoryNew');
const addCategoryBtn = document.getElementById('addCategoryBtn');

const fetchOpts = { credentials: 'include', cache: 'no-store' };

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCart() {
  return readStorage(CART_KEY, []);
}

function saveCart(cart) {
  writeStorage(CART_KEY, cart);
  updateCartBadge();
  renderCartDrawer();
}

function getHistory() {
  return readStorage(HISTORY_KEY, []);
}

function saveHistory(ids) {
  writeStorage(HISTORY_KEY, ids);
  renderRecentSection();
}

function cartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
  const count = cartCount();
  cartBadge.textContent = String(count);
  cartBadge.hidden = count === 0;
}

function isProductSold(product) {
  return Boolean(product?.sold);
}

function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  if (isProductSold(product)) {
    showToast('此商品已售出', 'error');
    return;
  }

  const cart = getCart();
  const index = cart.findIndex(item => item.id === productId);
  if (index === -1) {
    cart.push({ id: productId, qty: 1 });
  } else {
    cart[index].qty += 1;
  }
  saveCart(cart);
  showToast(`已加入購物車：${product.name}`);
}

function removeFromCart(productId) {
  saveCart(getCart().filter(item => item.id !== productId));
}

function changeCartQty(productId, delta) {
  const cart = getCart();
  const index = cart.findIndex(item => item.id === productId);
  if (index === -1) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
  showToast('購物車已清空');
}

function recordView(productId) {
  const ids = getHistory().filter(id => id !== productId);
  ids.unshift(productId);
  saveHistory(ids.slice(0, MAX_HISTORY));
}

function clearHistory() {
  saveHistory([]);
  showToast('瀏覽紀錄已清除');
}

function openCartDrawer() {
  cartDrawerBg.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  renderCartDrawer();
}

function closeCartDrawer() {
  cartDrawerBg.classList.remove('is-open');
  document.body.style.overflow = imageLightbox.classList.contains('is-open') ? 'hidden' : '';
}

function getCartSummaryText() {
  const cart = getCart();
  if (cart.length === 0) return '';

  const lines = ['VOID.STORE 購物車清單'];
  let total = 0;

  cart.forEach(item => {
    const product = allProducts.find(p => p.id === item.id);
    if (!product) return;
    const subtotal = product.price * item.qty;
    total += subtotal;
    lines.push(`- ${product.name} x${item.qty}  NT$ ${formatPrice(subtotal)}`);
  });

  lines.push(`合計 NT$ ${formatPrice(total)}`);
  lines.push('想確認庫存與運費，麻煩回覆，謝謝！');
  return lines.join('\n');
}

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function openLineGroup() {
  if (!lineGroupUrl) {
    showToast('請先設定 LINE 群組連結', 'error');
    return;
  }
  window.open(lineGroupUrl, '_blank', 'noopener');
  showToast('正在開啟 LINE 群組...');
}

function updateLineUi() {
  const hasGroup = Boolean(lineGroupUrl);
  lineGroupBtn.hidden = !hasGroup;
}

function renderCartDrawer() {
  const cart = getCart();
  if (cart.length === 0) {
    cartList.innerHTML = '<p class="cart-empty">購物車是空的</p>';
    cartFooter.hidden = true;
    return;
  }

  let total = 0;
  cartList.innerHTML = cart.map(item => {
    const product = allProducts.find(p => p.id === item.id);
    if (!product) return '';

    const subtotal = product.price * item.qty;
    total += subtotal;
    return `
      <article class="cart-item" data-id="${product.id}">
        <div class="cart-item-main">
          <div class="cart-item-name">${escapeHtml(product.name)}</div>
          <div class="cart-item-meta">NT$ ${formatPrice(product.price)} · ${escapeHtml(product.category)}</div>
        </div>
        <div class="cart-item-controls">
          <button type="button" class="qty-btn" data-action="dec" data-id="${product.id}">−</button>
          <span class="qty-value">${item.qty}</span>
          <button type="button" class="qty-btn" data-action="inc" data-id="${product.id}">+</button>
          <button type="button" class="qty-btn qty-btn-remove" data-action="remove" data-id="${product.id}">✕</button>
        </div>
      </article>
    `;
  }).join('');

  cartTotal.textContent = `NT$ ${formatPrice(total)}`;
  cartFooter.hidden = false;

  cartList.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'inc') changeCartQty(id, 1);
      else if (btn.dataset.action === 'dec') changeCartQty(id, -1);
      else if (btn.dataset.action === 'remove') removeFromCart(id);
    });
  });
}

function renderRecentCard(product) {
  const imageHtml = product.image
    ? `<img src="${product.image}" alt="${escapeHtml(product.name)}">`
    : '<div class="recent-placeholder">◌</div>';

  return `
    <button type="button" class="recent-card" data-id="${product.id}">
      <div class="recent-thumb">${imageHtml}</div>
      <span class="recent-name">${escapeHtml(product.name)}</span>
    </button>
  `;
}

function renderRecentSection() {
  const ids = getHistory();
  const products = ids
    .map(id => allProducts.find(p => p.id === id))
    .filter(Boolean);

  if (products.length === 0) {
    recentSection.hidden = true;
    recentGrid.innerHTML = '';
    return;
  }

  recentSection.hidden = false;
  recentGrid.innerHTML = products.map(renderRecentCard).join('');
  recentGrid.querySelectorAll('.recent-card').forEach(card => {
    card.addEventListener('click', () => {
      const product = allProducts.find(p => p.id === Number(card.dataset.id));
      if (product) openImageLightbox(product);
    });
  });
}

function toggleFileInputOverlay(input, enabled) {
  input.classList.toggle('is-disabled', !enabled);
}

imageInput.addEventListener('change', () => {
  if (imageInput.files[0]) showPreview(imageInput.files[0]);
});

removeImageBtn.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  imageInput.value = '';
  preview.hidden = true;
  dropContent.hidden = false;
  toggleFileInputOverlay(imageInput, true);
});

['dragenter', 'dragover'].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
});

dropZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    imageInput.files = dt.files;
    showPreview(file);
  }
});

function openLoginModal() {
  loginModal.classList.add('is-open');
  adminPassword.value = '';
  adminPassword.focus();
}

function closeLoginModal() {
  loginModal.classList.remove('is-open');
}

function openPasswordModal() {
  passwordForm.reset();
  passwordModal.classList.add('is-open');
  currentPassword.focus();
}

function closePasswordModal() {
  passwordModal.classList.remove('is-open');
  passwordForm.reset();
}

loginBtn.addEventListener('click', openLoginModal);
changePasswordBtn.addEventListener('click', openPasswordModal);
cancelPassword.addEventListener('click', closePasswordModal);
passwordModal.addEventListener('click', e => {
  if (e.target === passwordModal) closePasswordModal();
});

passwordForm.addEventListener('submit', async e => {
  e.preventDefault();

  if (newPassword.value !== confirmPassword.value) {
    showToast('兩次輸入的新密碼不一致', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      }),
      ...fetchOpts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '密碼變更失敗');

    closePasswordModal();
    setAdminMode(false);
    showToast('密碼已更新，請用新密碼重新登入');
    openLoginModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

cancelLogin.addEventListener('click', closeLoginModal);
loginModal.addEventListener('click', e => {
  if (e.target === loginModal) closeLoginModal();
});

cartBtn.addEventListener('click', openCartDrawer);
closeCartBtn.addEventListener('click', closeCartDrawer);
cartDrawerBg.addEventListener('click', e => {
  if (e.target === cartDrawerBg) closeCartDrawer();
});
clearCartBtn.addEventListener('click', clearCart);
clearHistoryBtn.addEventListener('click', clearHistory);
copyCartBtn.addEventListener('click', async () => {
  const text = getCartSummaryText();
  if (!text) return;
  if (await copyText(text)) showToast('購物車清單已複製');
  else showToast('複製失敗', 'error');
});

lineGroupBtn.addEventListener('click', openLineGroup);

eventSlotBtn?.addEventListener('click', e => {
  e.preventDefault();
});

adminLogoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST', ...fetchOpts });
  setAdminMode(false);
  showToast('管理員已登出');
  loadProducts();
});

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value }),
      ...fetchOpts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登入失敗');

    closeLoginModal();
    setAdminMode(true);
    showToast('登入成功');
    if (!persistentStorage) {
      showToast('雲端尚未設定 Supabase，商品可能在重新部署後消失', 'error');
    }
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

closeLightboxBtn.addEventListener('click', closeImageLightbox);
lightboxCartBtn.addEventListener('click', () => {
  if (!currentLightboxId) return;
  addToCart(currentLightboxId);
});
lightboxShareBtn.addEventListener('click', () => {
  if (currentLightboxId) shareProduct(currentLightboxId);
});

lightboxEditBtn.addEventListener('click', () => {
  if (!currentLightboxId) return;
  const product = allProducts.find(p => p.id === currentLightboxId);
  if (product) {
    closeImageLightbox();
    openEditModal(product);
  }
});

lightboxDeleteBtn.addEventListener('click', () => {
  if (currentLightboxId) deleteProduct(currentLightboxId);
});

lightboxSoldBtn?.addEventListener('click', () => {
  if (currentLightboxId) toggleProductSold(currentLightboxId);
});

editImageInput.addEventListener('change', () => {
  if (editImageInput.files[0]) showEditPreview(editImageInput.files[0]);
});

editRemoveImageBtn.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  resetEditImagePreview();
});

['dragenter', 'dragover'].forEach(evt => {
  editDropZone.addEventListener(evt, e => {
    e.preventDefault();
    editDropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(evt => {
  editDropZone.addEventListener(evt, e => {
    e.preventDefault();
    editDropZone.classList.remove('dragover');
  });
});

editDropZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    editImageInput.files = dt.files;
    showEditPreview(file);
  }
});

cancelEdit.addEventListener('click', closeEditModal);
editModal.addEventListener('click', e => {
  if (e.target === editModal) closeEditModal();
});

editDeleteBtn.addEventListener('click', () => {
  if (editingProductId) {
    closeEditModal();
    deleteProduct(editingProductId);
  }
});

editForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!editingProductId) return;

  const btnText = editSubmitBtn.querySelector('.btn-text');
  const btnLoading = editSubmitBtn.querySelector('.btn-loading');

  editSubmitBtn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  const formData = new FormData(editForm);
  formData.set('sold', editSold?.checked ? '1' : '0');

  try {
    const res = await fetch(`/api/products/${editingProductId}`, {
      method: 'PUT',
      body: formData,
      ...fetchOpts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '更新失敗');

    if (data.sold) removeFromCart(editingProductId);
    closeEditModal();
    showToast('商品已更新');
    loadProducts();
  } catch (err) {
    showToast(err.message || '更新失敗', 'error');
  } finally {
    editSubmitBtn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePasswordModal();
    closeEditModal();
    closeImageLightbox();
    closeLoginModal();
    closeCartDrawer();
  }
});

window.addEventListener('hashchange', handleProductHash);

function isPublicSite() {
  return !isLocalHost();
}

function setAdminMode(admin) {
  isAdmin = admin;
  uploadSection.classList.toggle('is-visible', admin);
  uploadSection.hidden = !admin;
  loginBtn.hidden = admin;
  changePasswordBtn.hidden = !admin;
  adminLogoutBtn.hidden = !admin;
  if (categoryAddRow) categoryAddRow.hidden = !admin;
  subtitle.textContent = admin ? '管理員模式' : '瀏覽精選商品';
  modeLabel.textContent = admin ? 'ADMIN' : 'VIEWER';
  modeLabel.classList.toggle('ok', admin);
  updateLineUi();
  updateLightboxActions();
  if (!admin) closeEditModal();
  renderGallery();
}

function populateCategorySelects(preferredValue) {
  const selects = [categorySelect, editCategory].filter(Boolean);
  const fallback = preferredValue || '其他';

  selects.forEach(select => {
    const previous = select.value;
    select.innerHTML = allCategories.map(cat => (
      `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    )).join('');

    const next = [preferredValue, previous, fallback].find(
      value => value && allCategories.includes(value),
    );
    select.value = next || allCategories[allCategories.length - 1];
  });
}

async function addCustomCategory() {
  const name = categoryNew?.value.trim();
  if (!name) {
    showToast('請輸入品項名稱', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      ...fetchOpts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '新增失敗');

    allCategories = data.categories || allCategories;
    populateCategorySelects(name);
    if (categoryNew) categoryNew.value = '';
    showToast(`已新增品項：${name}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function shuffleProducts(products) {
  const list = [...products];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function getDisplayProducts(filtered) {
  return shuffleProducts(filtered);
}

function applyMasonryStagger() {
  productsGrid.classList.add('gallery-grid--shuffle');
  productsGrid.querySelectorAll('.product-card').forEach((card, index) => {
    const offset = (index * 19 + Number(card.dataset.id) * 11) % 32;
    card.style.setProperty('--rand-offset', `${offset}px`);
  });
}

function resetGalleryCardLayout() {
  productsGrid.querySelectorAll('.product-card').forEach(card => {
    card.style.transform = '';
    card.style.width = '';
    card.style.margin = '';
    card.style.removeProperty('--rand-offset');
  });
  productsGrid.style.minHeight = '';
}

function updateRandomBrowseBtn() {
  if (!randomBrowseBtn) return;
  randomBrowseBtn.classList.toggle('active', randomBrowseMode);
  randomBrowseBtn.setAttribute('aria-pressed', String(randomBrowseMode));
  if (randomBrowseIndicator) {
    randomBrowseIndicator.textContent = randomBrowseMode ? 'ON' : 'OFF';
  }
}

function updateGalleryHint() {
  if (!physicsHint) return;
  physicsHint.textContent = randomBrowseMode
    ? '隨機排列瀏覽 · 點選商品開啟詳情'
    : '拖曳卡片可碰撞 · 輕點開啟商品';
}

function toggleRandomBrowse() {
  randomBrowseMode = !randomBrowseMode;
  renderGallery();
}

function initGalleryLayout() {
  resetGalleryCardLayout();
  updateRandomBrowseBtn();
  updateGalleryHint();

  if (randomBrowseMode) {
    productsGrid.classList.remove('gallery-grid--physics');
    productsGrid.classList.add('gallery-grid--shuffle');
    applyMasonryStagger();
    return;
  }

  productsGrid.classList.remove('gallery-grid--shuffle');
  initGalleryPhysics();
}

function showPreview(file) {
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    dropContent.hidden = true;
    preview.hidden = false;
    toggleFileInputOverlay(imageInput, false);
  };
  reader.readAsDataURL(file);
}

function showEditPreview(file) {
  const reader = new FileReader();
  reader.onload = e => {
    editPreviewImg.src = e.target.result;
    editDropContent.hidden = true;
    editPreview.hidden = false;
    toggleFileInputOverlay(editImageInput, false);
  };
  reader.readAsDataURL(file);
}

function resetEditImagePreview() {
  editImageInput.value = '';
  editPreview.hidden = true;
  editDropContent.hidden = false;
  toggleFileInputOverlay(editImageInput, true);
}

function updateLightboxActions() {
  if (lightboxGuestActions) lightboxGuestActions.hidden = isAdmin;
  if (lightboxAdminActions) lightboxAdminActions.hidden = !isAdmin;
}

function updateLightboxSoldUI(product) {
  const sold = isProductSold(product);

  if (lightboxSoldBadge) lightboxSoldBadge.hidden = !sold;
  if (lightboxSoldBtn) lightboxSoldBtn.textContent = sold ? 'RESTOCK' : 'SOLD';
  if (lightboxCartBtn) lightboxCartBtn.hidden = !isAdmin && sold;
  if (lightboxPrice) {
    lightboxPrice.classList.toggle('lb-price--sold', sold && !isAdmin);
  }
}

async function toggleProductSold(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product || !isAdmin) return;

  const nextSold = !isProductSold(product);

  try {
    const res = await fetch(`/api/products/${id}/sold`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sold: nextSold }),
      ...fetchOpts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '更新失敗');

    const index = allProducts.findIndex(p => p.id === id);
    if (index !== -1) allProducts[index] = data;

    if (nextSold) removeFromCart(id);
    renderGallery();
    renderRecentSection();
    renderCartDrawer();

    if (currentLightboxId === id) updateLightboxSoldUI(data);
    showToast(nextSold ? '已標記 SOLD' : '已恢復上架');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openEditModal(product) {
  if (!isAdmin || !product) return;

  editingProductId = product.id;
  editId.value = String(product.id);
  editName.value = product.name;
  editPrice.value = String(Math.round(product.price));
  populateCategorySelects(product.category || '其他');
  editSeries.value = product.series || 'nullcraft';
  editStockType.value = normalizeStockType(product.stock_type);
  if (editSold) editSold.checked = isProductSold(product);
  editDescription.value = product.description || '';
  resetEditImagePreview();

  if (product.image) {
    editCurrentImg.src = product.image;
    editCurrentImgWrap.hidden = false;
  } else {
    editCurrentImg.src = '';
    editCurrentImgWrap.hidden = true;
  }

  editModal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  editName.focus();
}

function closeEditModal() {
  editModal.classList.remove('is-open');
  editingProductId = null;
  editForm.reset();
  resetEditImagePreview();
  toggleFileInputOverlay(editImageInput, true);
  editCurrentImgWrap.hidden = true;
  if (!imageLightbox.classList.contains('is-open') && !cartDrawerBg.classList.contains('is-open')) {
    document.body.style.overflow = '';
  }
}

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 3000);
}

function formatPrice(price) {
  return Math.round(price).toLocaleString('zh-TW');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function normalizeStockType(value) {
  return value === 'AI製' ? 'AI製' : '現貨';
}

function stockTypeBadgeClass(stockType) {
  return normalizeStockType(stockType) === 'AI製'
    ? 'card-type-badge card-type-badge--ai'
    : 'card-type-badge card-type-badge--stock';
}

function renderStockTypeBadge(stockType) {
  const type = normalizeStockType(stockType);
  return `<span class="${stockTypeBadgeClass(type)}">${escapeHtml(type)}</span>`;
}

function applyStockTypeBadge(el, stockType) {
  if (!el) return;
  const type = normalizeStockType(stockType);
  el.textContent = type;
  el.className = stockTypeBadgeClass(type);
  el.hidden = false;
}

function isLocalHost() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function getShareBaseUrl() {
  if (publicBaseUrl) return publicBaseUrl.replace(/\/$/, '');
  if (!isLocalHost()) return location.origin;
  return null;
}

function getProductLink(id) {
  const base = getShareBaseUrl();
  if (!base) return null;
  return `${base}#product-${id}`;
}

async function shareProduct(id) {
  const link = getProductLink(id);
  if (!link) {
    showToast('請先執行 start-public.ps1 啟動公開分享', 'error');
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
    } else {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('連結已複製');
  } catch {
    showToast('複製失敗', 'error');
  }
}

async function loadSiteConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    publicBaseUrl = data.publicUrl || null;
    persistentStorage = data.persistentStorage !== false;
    lineGroupUrl = data.lineGroupUrl || null;
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      allCategories = data.categories;
    }
    populateCategorySelects();
    updateLineUi();

    if (publicBaseUrl) {
      publicUrlLabel.textContent = `PUBLIC: ${publicBaseUrl.replace('https://', '')}`;
      publicUrlLabel.hidden = false;
      publicUrlLabel.title = publicBaseUrl;
      publicUrlLabel.onclick = async () => {
        try {
          await navigator.clipboard.writeText(publicBaseUrl);
          showToast('公開網址已複製');
        } catch {
          showToast('複製失敗', 'error');
        }
      };
    } else {
      publicUrlLabel.hidden = true;
    }
  } catch {
    publicUrlLabel.hidden = true;
  }
}

function openImageLightbox(product) {
  currentLightboxId = product.id;
  history.replaceState(null, '', `#product-${product.id}`);
  recordView(product.id);

  lightboxCategory.textContent = `${product.series || 'nullcraft'} · ${product.category}`;
  applyStockTypeBadge(lightboxStockType, product.stock_type);
  lightboxName.textContent = product.name;
  lightboxDesc.textContent = product.description || '暫無商品描述';
  lightboxPrice.textContent = formatPrice(product.price);

  if (product.image) {
    lightboxImage.src = product.image;
    lightboxImage.alt = product.name;
    lightboxImage.hidden = false;
    lightboxPlaceholder.hidden = true;
  } else {
    lightboxImage.hidden = true;
    lightboxPlaceholder.hidden = false;
  }

  updateLightboxActions();
  updateLightboxSoldUI(product);
  imageLightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeImageLightbox() {
  imageLightbox.classList.remove('is-open');
  document.body.style.overflow = cartDrawerBg.classList.contains('is-open') ? 'hidden' : '';
  currentLightboxId = null;
  if (location.hash.startsWith('#product-')) {
    history.replaceState(null, '', location.pathname);
  }
}

function getFilteredProducts() {
  if (activeSeriesFilter === 'all') return allProducts;
  return allProducts.filter(product => (product.series || 'nullcraft') === activeSeriesFilter);
}

function countSeriesItems(series) {
  if (series === 'all') return allProducts.length;
  return allProducts.filter(product => (product.series || 'nullcraft') === series).length;
}

function updateFilterTags() {
  if (!filterTags) return;

  filterTags.querySelectorAll('.filter-tag').forEach(btn => {
    const series = btn.dataset.series;
    const count = countSeriesItems(series);
    const label = series === 'all' ? 'ALL' : series;

    btn.classList.toggle('active', series === activeSeriesFilter);
    btn.innerHTML = `
      <span class="filter-tag-label">${escapeHtml(label)}</span>
      <span class="filter-tag-count">${count}</span>
    `;
    btn.disabled = series !== 'all' && count === 0;
  });
}

function setSeriesFilter(series) {
  activeSeriesFilter = series;
  renderGallery();
}

function renderGallery() {
  const filtered = getFilteredProducts();
  const total = allProducts.length;

  productCount.textContent = activeSeriesFilter === 'all'
    ? `${total} ITEMS`
    : `${filtered.length} / ${total} ITEMS`;

  updateFilterTags();

  window.GalleryPhysics?.destroy();
  productsGrid.classList.remove('gallery-grid--physics');

  if (total === 0) {
    productsGrid.innerHTML = `
      <div class="empty-state" id="emptyState">
        <span class="empty-icon">◌</span>
        <span class="empty-text">尚無商品</span>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    productsGrid.innerHTML = `
      <div class="empty-state" id="emptyState">
        <span class="empty-icon">◌</span>
        <span class="empty-text">此系列尚無作品</span>
      </div>`;
    return;
  }

  productsGrid.innerHTML = getDisplayProducts(filtered).map(renderProduct).join('');
  bindProductEvents();
  initGalleryLayout();

  if (location.hash.startsWith('#product-')) handleProductHash();
}

function initGalleryPhysics() {
  productsGrid.classList.add('gallery-grid--physics');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const mounted = window.GalleryPhysics?.mount(productsGrid, productId => {
        const product = allProducts.find(p => p.id === productId);
        if (product) openImageLightbox(product);
      });
      if (!mounted) applyMasonryStagger();
    });
  });
}

function renderProduct(product) {
  const sold = isProductSold(product);
  const imageHtml = product.image
    ? `<img src="${product.image}" alt="${escapeHtml(product.name)}">`
    : `<div class="product-image-placeholder">◌</div>`;

  const adminBtns = isAdmin
    ? `<button class="card-action-btn sold-btn" data-action="toggle-sold" data-id="${product.id}">${sold ? 'RESTOCK' : 'SOLD'}</button>
       <button class="card-action-btn edit-btn" data-action="edit" data-id="${product.id}">EDIT</button>
       <button class="delete-btn" data-action="delete" data-id="${product.id}">DEL</button>`
    : '';

  const cartBtnHtml = isAdmin || sold
    ? ''
    : `<button class="card-action-btn" data-action="cart" data-id="${product.id}">CART</button>`;

  const shareBtnHtml = isAdmin
    ? ''
    : `<button class="card-action-btn share-btn" data-action="share" data-id="${product.id}">SHARE</button>`;

  return `
    <article class="gallery-card product-card${sold ? ' product-card--sold' : ''}" id="product-${product.id}" data-id="${product.id}">
      <div class="card-img-wrap product-image-wrap" data-action="view" data-id="${product.id}">
        ${imageHtml}
        ${sold ? '<div class="sold-stamp" aria-hidden="true">SOLD</div>' : ''}
        ${renderStockTypeBadge(product.stock_type)}
        <div class="card-overlay">
          <div class="card-meta-wrap">
            <div class="card-badges">
              <span class="card-badge card-badge-series">${escapeHtml(product.series || 'nullcraft')}</span>
              <span class="card-badge">${escapeHtml(product.category)}</span>
            </div>
            <div class="card-title">${escapeHtml(product.name)}</div>
            ${product.description ? `<div class="card-desc">${escapeHtml(product.description)}</div>` : ''}
            <div class="card-price${sold ? ' card-price--sold' : ''}">NT$ ${formatPrice(product.price)}</div>
          </div>
        </div>
        <div class="card-actions">
          ${cartBtnHtml}
          ${shareBtnHtml}
          ${adminBtns}
        </div>
      </div>
    </article>
  `;
}

function bindProductEvents() {
  productsGrid.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id = Number(el.dataset.id);
      const product = allProducts.find(p => p.id === id);
      if (!product) return;

      if (el.dataset.action === 'view') openImageLightbox(product);
      else if (el.dataset.action === 'share') shareProduct(id);
      else if (el.dataset.action === 'cart') addToCart(id);
      else if (el.dataset.action === 'edit') {
        closeImageLightbox();
        openEditModal(product);
      } else if (el.dataset.action === 'toggle-sold') toggleProductSold(id);
      else if (el.dataset.action === 'delete') deleteProduct(id);
    });
  });

  if (!window.GalleryPhysics?.isActive()) {
    productsGrid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-action]')) return;
        const id = Number(card.dataset.id);
        const product = allProducts.find(p => p.id === id);
        if (product) openImageLightbox(product);
      });
    });
  }
}

function highlightProduct(id) {
  productsGrid.querySelectorAll('.product-card').forEach(card => {
    card.classList.toggle('is-highlighted', Number(card.dataset.id) === id);
  });
}

function handleProductHash() {
  const match = location.hash.match(/^#product-(\d+)$/);
  if (!match) return;

  const id = Number(match[1]);
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  const card = document.getElementById(`product-${id}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightProduct(id);
    setTimeout(() => highlightProduct(null), 2000);
  }

  openImageLightbox(product);
}

async function checkAdminStatus() {
  setAdminMode(false);
  closeLoginModal();

  if (isPublicSite()) {
    try {
      await fetch('/api/admin/logout', { method: 'POST', ...fetchOpts });
    } catch { /* ignore */ }
  }
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderGallery();
    renderRecentSection();
    renderCartDrawer();
  } catch {
    showToast('載入商品失敗', 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('確定要刪除此商品嗎？')) return;

  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE', ...fetchOpts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '刪除失敗');
    if (editingProductId === Number(id)) closeEditModal();
    if (currentLightboxId === Number(id)) closeImageLightbox();
    removeFromCart(Number(id));
    saveHistory(getHistory().filter(itemId => itemId !== Number(id)));
    showToast('商品已刪除');
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault();

  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');

  submitBtn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  const formData = new FormData(form);

  try {
    const res = await fetch('/api/products', { method: 'POST', body: formData, ...fetchOpts });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || '上傳失敗');

    showToast('商品上架成功');
    form.reset();
    imageInput.value = '';
    preview.hidden = true;
    dropContent.hidden = false;
    toggleFileInputOverlay(imageInput, true);
    loadProducts();
  } catch (err) {
    showToast(err.message || '上傳失敗', 'error');
  } finally {
    submitBtn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
  }
});

filterTags?.querySelectorAll('.filter-tag').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    setSeriesFilter(btn.dataset.series);
  });
});

randomBrowseBtn?.addEventListener('click', toggleRandomBrowse);

addCategoryBtn?.addEventListener('click', addCustomCategory);
categoryNew?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomCategory();
  }
});

populateCategorySelects('其他');

toggleFileInputOverlay(imageInput, true);
toggleFileInputOverlay(editImageInput, true);
updateCartBadge();
loadSiteConfig()
  .then(checkAdminStatus)
  .then(loadProducts);