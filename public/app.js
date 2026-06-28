let isAdmin = false;
let isMember = false;
let allProducts = [];
let currentLightboxId = null;
let publicBaseUrl = null;
let googleClientId = null;

const form = document.getElementById('uploadForm');
const imageInput = document.getElementById('image');
const dropZone = document.getElementById('dropZone');
const dropContent = document.getElementById('dropContent');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const browseBtn = document.getElementById('browseBtn');
const removeImageBtn = document.getElementById('removeImage');
const productsGrid = document.getElementById('productsGrid');
const emptyState = document.getElementById('emptyState');
const productCount = document.getElementById('productCount');
const modeLabel = document.getElementById('modeLabel');
const submitBtn = document.getElementById('submitBtn');
const toast = document.getElementById('toast');
const uploadSection = document.getElementById('uploadSection');
const loginBtn = document.getElementById('loginBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const memberLoginBtn = document.getElementById('memberLoginBtn');
const memberLogoutBtn = document.getElementById('memberLogoutBtn');
const memberChip = document.getElementById('memberChip');
const memberModal = document.getElementById('memberModal');
const cancelMemberLogin = document.getElementById('cancelMemberLogin');
const googleSetupHint = document.getElementById('googleSetupHint');
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
const lightboxName = document.getElementById('lightboxName');
const lightboxDesc = document.getElementById('lightboxDesc');
const lightboxPrice = document.getElementById('lightboxPrice');
const lightboxShareBtn = document.getElementById('lightboxShareBtn');
const publicUrlLabel = document.getElementById('publicUrlLabel');

const fetchOpts = { credentials: 'include' };

browseBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', () => {
  if (imageInput.files[0]) showPreview(imageInput.files[0]);
});

removeImageBtn.addEventListener('click', e => {
  e.stopPropagation();
  imageInput.value = '';
  preview.hidden = true;
  dropContent.hidden = false;
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

dropZone.addEventListener('click', () => imageInput.click());

function openLoginModal() {
  loginModal.classList.add('is-open');
  adminPassword.value = '';
  adminPassword.focus();
}

function closeLoginModal() {
  loginModal.classList.remove('is-open');
}

loginBtn.addEventListener('click', openLoginModal);
cancelLogin.addEventListener('click', closeLoginModal);
loginModal.addEventListener('click', e => {
  if (e.target === loginModal) closeLoginModal();
});

adminLogoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST', ...fetchOpts });
  setAdminMode(false);
  showToast('管理員已登出');
  loadProducts();
});

memberLoginBtn.addEventListener('click', openMemberModal);
cancelMemberLogin.addEventListener('click', closeMemberModal);
memberModal.addEventListener('click', e => {
  if (e.target === memberModal) closeMemberModal();
});

memberLogoutBtn.addEventListener('click', async () => {
  await fetch('/api/member/logout', { method: 'POST', ...fetchOpts });
  setMemberMode(false);
  showToast('會員已登出');
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
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

closeLightboxBtn.addEventListener('click', closeImageLightbox);
lightboxShareBtn.addEventListener('click', () => {
  if (currentLightboxId) shareProduct(currentLightboxId);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeImageLightbox();
    closeLoginModal();
    closeMemberModal();
  }
});

function openMemberModal() {
  memberModal.classList.add('is-open');
  initGoogleSignIn();
}

function closeMemberModal() {
  memberModal.classList.remove('is-open');
}

function setMemberMode(loggedIn, member = null) {
  isMember = loggedIn;
  memberLoginBtn.hidden = loggedIn;
  memberLogoutBtn.hidden = !loggedIn;
  memberChip.hidden = !loggedIn;

  if (loggedIn && member) {
    const label = member.name || member.email;
    memberChip.textContent = label.length > 14 ? `${label.slice(0, 14)}…` : label;
    memberChip.title = member.email;
    if (!isAdmin) subtitle.textContent = '會員已登入';
  } else if (!isAdmin) {
    subtitle.textContent = '瀏覽精選商品';
  }

  if (!isAdmin) {
    modeLabel.textContent = loggedIn ? 'MEMBER' : 'VIEWER';
    modeLabel.classList.toggle('ok', loggedIn);
  }
}

async function handleGoogleCredential(response) {
  try {
    const res = await fetch('/api/member/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
      ...fetchOpts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登入失敗');

    closeMemberModal();
    setMemberMode(true, data.member);
    showToast(`歡迎，${data.member.name || data.member.email}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initGoogleSignIn() {
  const btnContainer = document.getElementById('googleSignInBtn');
  btnContainer.innerHTML = '';

  if (!googleClientId) {
    googleSetupHint.hidden = false;
    return;
  }

  googleSetupHint.hidden = true;

  if (!window.google?.accounts?.id) {
    btnContainer.innerHTML = '<span class="modal-hint">載入 Google 登入中...</span>';
    setTimeout(initGoogleSignIn, 500);
    return;
  }

  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredential,
    auto_select: true,
  });

  google.accounts.id.renderButton(btnContainer, {
    theme: 'filled_black',
    size: 'large',
    width: 280,
    text: 'signin_with',
    locale: 'zh-TW',
    shape: 'rectangular',
  });
}

async function checkMemberStatus() {
  try {
    const res = await fetch('/api/member/status', fetchOpts);
    const data = await res.json();
    setMemberMode(data.isLoggedIn, data.member);
  } catch {
    setMemberMode(false);
  }
}

window.addEventListener('hashchange', handleProductHash);

function isPublicSite() {
  return !isLocalHost();
}

function setAdminMode(admin) {
  isAdmin = admin;
  uploadSection.classList.toggle('is-visible', admin);
  uploadSection.hidden = !admin;
  loginBtn.hidden = admin;
  adminLogoutBtn.hidden = !admin;
  if (!isMember) {
    subtitle.textContent = admin ? '管理員模式' : '瀏覽精選商品';
  }
  modeLabel.textContent = admin ? 'ADMIN' : (isMember ? 'MEMBER' : 'VIEWER');
  modeLabel.classList.toggle('ok', admin || isMember);
}

function showPreview(file) {
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    dropContent.hidden = true;
    preview.hidden = false;
  };
  reader.readAsDataURL(file);
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
    googleClientId = data.googleClientId || null;

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

  lightboxCategory.textContent = product.category;
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

  imageLightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeImageLightbox() {
  imageLightbox.classList.remove('is-open');
  document.body.style.overflow = '';
  currentLightboxId = null;
  if (location.hash.startsWith('#product-')) {
    history.replaceState(null, '', location.pathname);
  }
}

function renderProduct(product) {
  const imageHtml = product.image
    ? `<img src="${product.image}" alt="${escapeHtml(product.name)}">`
    : `<div class="product-image-placeholder">◌</div>`;

  const deleteBtn = isAdmin
    ? `<button class="delete-btn" data-action="delete" data-id="${product.id}">DEL</button>`
    : '';

  return `
    <article class="gallery-card product-card" id="product-${product.id}" data-id="${product.id}">
      <div class="card-img-wrap product-image-wrap" data-action="view" data-id="${product.id}">
        ${imageHtml}
        <div class="card-overlay">
          <div class="card-meta-wrap">
            <span class="card-badge">${escapeHtml(product.category)}</span>
            <div class="card-title">${escapeHtml(product.name)}</div>
            ${product.description ? `<div class="card-desc">${escapeHtml(product.description)}</div>` : ''}
            <div class="card-price">NT$ ${formatPrice(product.price)}</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="card-action-btn share-btn" data-action="share" data-id="${product.id}">SHARE</button>
          ${deleteBtn}
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
      else if (el.dataset.action === 'delete') deleteProduct(id);
    });
  });

  productsGrid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-action]')) return;
      const id = Number(card.dataset.id);
      const product = allProducts.find(p => p.id === id);
      if (product) openImageLightbox(product);
    });
  });
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

    productCount.textContent = `${allProducts.length} ITEMS`;

    if (allProducts.length === 0) {
      productsGrid.innerHTML = `
        <div class="empty-state" id="emptyState">
          <span class="empty-icon">◌</span>
          <span class="empty-text">尚無商品</span>
        </div>`;
      return;
    }

    productsGrid.innerHTML = allProducts.map(renderProduct).join('');
    bindProductEvents();

    if (location.hash.startsWith('#product-')) handleProductHash();
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
    if (currentLightboxId === Number(id)) closeImageLightbox();
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
    loadProducts();
  } catch (err) {
    showToast(err.message || '上傳失敗', 'error');
  } finally {
    submitBtn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
  }
});

loadSiteConfig()
  .then(() => Promise.all([checkAdminStatus(), checkMemberStatus()]))
  .then(loadProducts);