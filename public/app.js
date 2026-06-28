let isAdmin = false;
let isMember = false;
let allProducts = [];
let currentLightboxId = null;
let publicBaseUrl = null;
let googleClientId = null;
let googleInitialized = false;
let googleButtonRendered = false;

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
const memberAvatar = document.getElementById('memberAvatar');
const memberLabel = document.getElementById('memberLabel');
const memberModal = document.getElementById('memberModal');
const cancelMemberLogin = document.getElementById('cancelMemberLogin');
const googleSetupHint = document.getElementById('googleSetupHint');
const googleLoginFallback = document.getElementById('googleLoginFallback');
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
googleLoginFallback?.addEventListener('click', triggerGoogleSignIn);
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
  ensureGoogleLoginReady();
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
    memberLabel.textContent = label.length > 12 ? `${label.slice(0, 12)}…` : label;
    memberChip.title = member.email;
    if (member.picture) {
      memberAvatar.src = member.picture;
      memberAvatar.hidden = false;
    } else {
      memberAvatar.hidden = true;
    }
    if (!isAdmin) subtitle.textContent = '會員已登入';
  } else {
    memberAvatar.hidden = true;
    memberLabel.textContent = '';
    if (!isAdmin) subtitle.textContent = '瀏覽精選商品';
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

function googlePromptReasonMessage(reason) {
  const messages = {
    browser_not_supported: '瀏覽器不支援 Google 登入，請改用 Chrome 或 Edge',
    invalid_client: 'Google Client ID 設定錯誤，請檢查 OAuth 設定',
    missing_client_id: '尚未設定 Google Client ID',
    opt_out_or_no_session: '請允許第三方登入或 Cookie，然後重新整理頁面',
    secure_http_required: 'Google 登入需要 HTTPS 網址',
    suppressed_by_user: 'Google 登入已遭封鎖，請關閉廣告阻擋或隱私外掛',
    unregistered_origin: '網址未加入 Google OAuth 授權來源，請到 Google Console 加入此網域',
    unknown_reason: 'Google 登入暫時無法使用，請稍後再試',
  };
  return messages[reason] || `Google 登入失敗：${reason}`;
}

function setupGoogleAuth() {
  if (!googleClientId || googleInitialized) return !!googleInitialized;

  if (!window.google?.accounts?.id) {
    return false;
  }

  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredential,
    auto_select: false,
    context: 'signin',
    itp_support: true,
    use_fedcm_for_prompt: false,
  });

  googleInitialized = true;
  googleSetupHint.hidden = true;
  return true;
}

function showFallbackGoogleButton(show = true) {
  if (!googleLoginFallback) return;
  googleLoginFallback.hidden = !show;
}

function triggerGoogleSignIn() {
  if (!googleClientId) {
    googleSetupHint.hidden = false;
    showToast('Google 登入尚未設定', 'error');
    return;
  }

  if (!setupGoogleAuth()) {
    showToast('Google 登入載入中，請稍候', 'error');
    ensureGoogleLoginReady();
    return;
  }

  googleLoginFallback.disabled = true;
  window.setTimeout(() => {
    googleLoginFallback.disabled = false;
  }, 3000);

  google.accounts.id.prompt(notification => {
    if (!notification) return;

    if (notification.isNotDisplayed()) {
      showToast(googlePromptReasonMessage(notification.getNotDisplayedReason()), 'error');
      return;
    }

    if (notification.isSkippedMoment()) {
      const reason = notification.getSkippedReason();
      if (reason === 'user_cancel' || reason === 'tap_outside') return;
      showToast(googlePromptReasonMessage(reason), 'error');
    }
  });
}

function renderGoogleButton() {
  const btnContainer = document.getElementById('googleSignInBtn');
  if (!btnContainer || !googleClientId) {
    googleSetupHint.hidden = false;
    showFallbackGoogleButton(false);
    return;
  }

  if (!setupGoogleAuth()) {
    showFallbackGoogleButton(true);
    return;
  }

  btnContainer.innerHTML = '';
  btnContainer.hidden = true;
  showFallbackGoogleButton(true);
  googleLoginFallback.disabled = false;
  googleButtonRendered = true;
}

function ensureGoogleLoginReady() {
  if (!googleClientId) {
    googleSetupHint.hidden = false;
    showFallbackGoogleButton(false);
    return;
  }

  if (!window.google?.accounts?.id) {
    showFallbackGoogleButton(true);
    window.setTimeout(ensureGoogleLoginReady, 300);
    return;
  }

  setupGoogleAuth();
  renderGoogleButton();
}

function showGoogleOneTap() {
  if (!googleClientId || isMember || isAdmin) return;
  if (!setupGoogleAuth()) {
    setTimeout(showGoogleOneTap, 500);
    return;
  }
  google.accounts.id.prompt(notification => {
    if (!notification?.isNotDisplayed()) return;
    const reason = notification.getNotDisplayedReason();
    if (reason === 'suppressed_by_user' || reason === 'opt_out_or_no_session') return;
    console.info('Google One Tap:', reason);
  });
}

async function checkMemberStatus() {
  try {
    const res = await fetch('/api/member/status', fetchOpts);
    const data = await res.json();
    setMemberMode(data.isLoggedIn, data.member);
    if (!data.isLoggedIn && googleClientId) {
      setTimeout(showGoogleOneTap, 800);
    }
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
    if (googleClientId) ensureGoogleLoginReady();

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