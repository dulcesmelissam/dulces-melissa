const API_URL = 'https://script.google.com/macros/s/AKfycbwzZ3FQ-AfE4r9HgvSdsHCYsf9CtzbYY7hN3bakiYQH-FdAeoYO_B-l0NzfLsLnk0Fm/exec';

// ─── State ────────────────────────────────────────────────────────────────────
let allProducts     = [];
let activeFilter     = 'all';
let searchQuery       = '';
let lastLoadTime     = 0;
let bestSellerCodes  = [];
let currentView      = 'home';
let cart             = [];
let lastCartCount    = 0;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  loadProducts();
  loadBestSellers();
  updateSearchPlaceholder();
  showView(location.hash === '#catalogo' ? 'catalogo' : 'home');
});

window.addEventListener('resize', updateSearchPlaceholder);
window.addEventListener('resize', () => updateChipIndicator());

function updateSearchPlaceholder() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.placeholder = window.innerWidth < 480 ? 'Buscar...' : '¿Qué se te antoja hoy?';
}

function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('hidden');
  document.getElementById('mobileNavOverlay').classList.toggle('hidden');
}

// ─── Vistas: Home / Catálogo ───────────────────────────────────────────────────
function showView(view) {
  currentView = view;
  document.getElementById('homeView').classList.toggle('hidden', view !== 'home');
  document.getElementById('catalogoView').classList.toggle('hidden', view !== 'catalogo');
  document.getElementById('searchBar').classList.toggle('hidden', view !== 'catalogo');
  location.hash = view === 'catalogo' ? 'catalogo' : 'inicio';
  window.scrollTo(0, 0);
}

function navigateTo(target) {
  if (target === 'catalogo') {
    showView('catalogo');
    return;
  }
  showView('home');
  requestAnimationFrame(() => {
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - lastLoadTime > 2 * 60 * 1000) {
    loadProducts();
  }
});

// ─── Products ─────────────────────────────────────────────────────────────────
function loadProducts() {
  document.getElementById('loadingSpinner').classList.remove('hidden');
  document.getElementById('catalogContainer').classList.add('hidden');

  fetch(API_URL + '?api=1')
    .then(r => r.json())
    .then(res => {
      document.getElementById('loadingSpinner').classList.add('hidden');
      if (!res.ok) { showToast('Error al cargar productos', 'error'); return; }
      allProducts  = res.data;
      lastLoadTime = Date.now();
      renderFilterTabs();
      renderCatalog();
      renderFeatured();
      document.getElementById('catalogContainer').classList.remove('hidden');
    })
    .catch(() => {
      document.getElementById('loadingSpinner').classList.add('hidden');
      showToast('Error al cargar productos', 'error');
    });
}

function loadBestSellers() {
  fetch(API_URL + '?bestsellers=1')
    .then(r => r.json())
    .then(res => {
      bestSellerCodes = res.ok ? res.data : [];
      renderFeatured();
    })
    .catch(() => { renderFeatured(); });
}

function setSearchQuery(value) {
  const wasEmpty = !searchQuery;
  searchQuery = value.trim().toLowerCase();
  renderCatalog();
  renderFilterTabs();
  if (wasEmpty && searchQuery) {
    showView('catalogo');
  }
}

function renderCatalog() {
  const container = document.getElementById('catalogContainer');
  const visible = activeFilter === 'all'
    ? allProducts
    : allProducts.filter(p => p.categoria === activeFilter);

  let list = visible.filter(p => p.activo !== false);

  if (searchQuery) {
    list = list.filter(p => p.nombre.toLowerCase().includes(searchQuery));
  }

  if (list.length === 0) {
    const msg = searchQuery ? 'No se encontraron productos.' : 'No hay productos en esta categoría.';
    container.innerHTML = `<p style="text-align:center;padding:70px 20px;color:var(--text-light);font-size:1rem">${msg}</p>`;
    return;
  }

  const cats = [...new Set(list.map(p => p.categoria))];
  container.innerHTML = cats.map(cat => `
    <section class="catalog-section">
      <h2 class="section-title">${cat}</h2>
      <div class="products-grid">
        ${list.filter(p => p.categoria === cat).map((p, i) => renderCard(p, i)).join('')}
      </div>
    </section>
  `).join('');
  initScrollReveal();
}

// ─── Destacados / Carrusel ─────────────────────────────────────────────────────
function renderFeatured() {
  const track = document.getElementById('featuredCarousel');
  if (!track || allProducts.length === 0) return;

  const active = allProducts.filter(p => p.activo !== false);
  const byCode = new Map(active.map(p => [String(p.id).toLowerCase(), p]));
  const featured = [];
  bestSellerCodes.forEach(code => {
    const p = byCode.get(String(code).toLowerCase());
    if (p && !featured.includes(p)) featured.push(p);
  });
  for (const p of active) {
    if (featured.length >= 8) break;
    if (!featured.includes(p)) featured.push(p);
  }

  track.innerHTML = featured.slice(0, 8).map((p, i) => renderCard(p, i)).join('');
  renderCarouselDots(featured.length);
  track.removeEventListener('scroll', onCarouselScroll);
  track.addEventListener('scroll', onCarouselScroll);
  initScrollReveal();

  document.getElementById('featuredLoading').classList.add('hidden');
  document.getElementById('featuredCarouselWrap').classList.remove('hidden');
  document.getElementById('carouselDots').classList.remove('hidden');
  document.getElementById('featuredCta').classList.remove('hidden');
}

function renderCarouselDots(count) {
  const dotsEl = document.getElementById('carouselDots');
  if (!dotsEl) return;
  dotsEl.innerHTML = Array.from({ length: count }).map((_, i) =>
    `<button class="carousel-dot${i === 0 ? ' active' : ''}" onclick="carouselGoTo(${i})" aria-label="Ir al producto ${i + 1}"></button>`
  ).join('');
}

function carouselScroll(dir) {
  const track = document.getElementById('featuredCarousel');
  if (!track) return;
  const card = track.querySelector('.product-card');
  const step = card ? card.getBoundingClientRect().width + 20 : 240;
  track.scrollBy({ left: dir * step, behavior: 'smooth' });
}

function carouselGoTo(index) {
  const track = document.getElementById('featuredCarousel');
  if (!track) return;
  const card = track.children[index];
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
}

let carouselScrollTimer = null;
function onCarouselScroll() {
  clearTimeout(carouselScrollTimer);
  carouselScrollTimer = setTimeout(updateCarouselDots, 80);
}

function updateCarouselDots() {
  const track = document.getElementById('featuredCarousel');
  const dotsEl = document.getElementById('carouselDots');
  if (!track || !dotsEl) return;
  const cards = [...track.children];
  if (cards.length === 0) return;
  const trackLeft = track.getBoundingClientRect().left;
  let closest = 0, closestDist = Infinity;
  cards.forEach((card, i) => {
    const dist = Math.abs(card.getBoundingClientRect().left - trackLeft);
    if (dist < closestDist) { closestDist = dist; closest = i; }
  });
  dotsEl.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === closest));
}

function driveImgUrl(url) {
  if (!url) return url;
  const m = url.match(/[?&]id=([^&]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=w900';
  return url;
}

function renderCard(p, idx = 0) {
  const safeNombre = p.nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const imgUrl = driveImgUrl(p.imagenUrl);

  const imgHtml = imgUrl
    ? `<img class="product-img" src="${imgUrl}" alt="${safeNombre}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';

  const placeholder = `<div class="product-img-placeholder" ${p.imagenUrl ? 'style="display:none"' : ''}></div>`;

  let stockBadge = '';
  if (p.stockCajas != null) {
    if (p.stockCajas === 0) {
      stockBadge = `<span class="stock-badge stock-out">⚪ Agotado</span>`;
    } else if (p.stockCajas <= 5) {
      stockBadge = `<span class="stock-badge stock-low">🔥 Quedan ${p.stockCajas}</span>`;
    } else {
      stockBadge = `<span class="stock-badge stock-ok">🟢 En stock</span>`;
    }
  }

  return `
    <article class="product-card" id="card-${p.id}" data-stock="${p.stockCajas != null ? p.stockCajas : ''}" style="animation-delay:${idx * 0.05}s">
      <div class="product-img-wrap">
        ${imgHtml}
        ${placeholder}
      </div>
      <div class="product-body">
        <h3 class="product-name">${p.nombre}</h3>
        <p class="product-desc">${p.descripcion}</p>
        <div class="product-footer">
          <span class="product-qty">${p.cantidad} ${p.tipoUnidad}</span>
          <span class="product-price">$${Number(p.precio).toLocaleString('es-CL')}</span>
        </div>
        ${stockBadge}
        <div class="card-qty-stepper">
          <button class="cart-qty-btn" onclick="event.stopPropagation();changeCardQty(this,-1)" aria-label="Restar unidad">−</button>
          <span class="card-qty-value">1</span>
          <button class="cart-qty-btn" onclick="event.stopPropagation();changeCardQty(this,1)" aria-label="Sumar unidad">+</button>
        </div>
        <button class="btn-add" onclick="event.stopPropagation();addToCart('${p.id}', this)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Lo quiero
        </button>
      </div>
    </article>`;
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
function renderFilterTabs() {
  const visible  = allProducts.filter(p => p.activo !== false);
  const searched = searchQuery ? visible.filter(p => p.nombre.toLowerCase().includes(searchQuery)) : visible;
  const cats = [...new Set(visible.map(p => p.categoria))];
  const tabs = [
    { f: 'all', l: 'Todos', count: searched.length },
    ...cats.map(c => ({ f: c, l: c, count: searched.filter(p => p.categoria === c).length }))
  ];

  document.getElementById('filterTabsContainer').innerHTML = `
    <div class="filter-tabs">
      <div class="chip-indicator" id="chipIndicator"></div>
      ${tabs.map(t => `
        <button class="chip${t.f === activeFilter ? ' active' : ''}"
                data-filter="${t.f}"
                onclick="setFilter('${t.f}')">
          ${t.l} <span class="filter-count">${t.count}</span>
        </button>`).join('')}
    </div>`;
  requestAnimationFrame(updateChipIndicator);
}

function updateChipIndicator() {
  const indicator = document.getElementById('chipIndicator');
  const active = document.querySelector('.chip.active');
  if (!indicator || !active) return;
  indicator.style.width = active.offsetWidth + 'px';
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.chip').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  updateChipIndicator();
  renderCatalogTransition();
}

function renderCatalogTransition() {
  const container = document.getElementById('catalogContainer');
  container.classList.add('catalog-exiting');
  setTimeout(() => {
    renderCatalog();
    container.classList.remove('catalog-exiting');
  }, 220);
}

// ─── Carrito ──────────────────────────────────────────────────────────────────
function loadCart() {
  try {
    const raw = localStorage.getItem('dulcesMelissaCart');
    cart = raw ? JSON.parse(raw) : [];
  } catch (e) {
    cart = [];
  }
  renderCartBadge();
}

function persistCart() {
  localStorage.setItem('dulcesMelissaCart', JSON.stringify(cart));
}

function cartTotal() {
  return cart.reduce((sum, c) => sum + c.precio * c.cantidad, 0);
}

function cartCount() {
  return cart.reduce((sum, c) => sum + c.cantidad, 0);
}

function cardStockLimit(card) {
  if (!card) return Infinity;
  const raw = card.dataset.stock;
  if (raw === '' || raw == null) return Infinity;
  const n = parseInt(raw, 10);
  return isNaN(n) ? Infinity : n;
}

function changeCardQty(btn, delta) {
  const card = btn.closest('.product-card');
  const wrap = btn.closest('.card-qty-stepper');
  const span = wrap && wrap.querySelector('.card-qty-value');
  if (!span) return;
  const max = cardStockLimit(card);
  const qty = Math.min(max, Math.max(1, (parseInt(span.textContent, 10) || 1) + delta));
  span.textContent = qty;
}

function addToCart(id, btn) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  const card = btn && btn.closest('.product-card');
  const max = cardStockLimit(card);
  const qtySpan = card && card.querySelector('.card-qty-value');
  const requested = qtySpan ? Math.max(1, parseInt(qtySpan.textContent, 10) || 1) : 1;

  const existing = cart.find(c => c.id === id);
  const alreadyInCart = existing ? existing.cantidad : 0;
  const available = max - alreadyInCart;

  if (available <= 0) {
    showToast('No queda más stock disponible de este producto', 'error');
    return;
  }

  const qty = Math.min(requested, available);
  if (existing) {
    existing.cantidad += qty;
  } else {
    cart.push({ id: product.id, nombre: product.nombre, precio: Number(product.precio), imagenUrl: product.imagenUrl, cantidad: qty });
  }
  persistCart();
  renderCartBadge();
  renderCartDrawer();
  showToast(
    qty < requested ? `Solo agregamos ${qty} (stock limitado) ✓` : `Agregado al carrito ✓ (${qty})`,
    qty < requested ? 'error' : 'success'
  );
  bounceCard(id);
  shakeCartIcon();
  if (qtySpan) qtySpan.textContent = 1;
}

function bounceCard(id) {
  document.querySelectorAll('[id="card-' + id + '"]').forEach(card => {
    card.classList.remove('card-bounce');
    void card.offsetWidth;
    card.classList.add('card-bounce');
  });
}

function shakeCartIcon() {
  const cartBtn = document.querySelector('.cart-btn');
  if (!cartBtn) return;
  cartBtn.classList.remove('cart-shake');
  void cartBtn.offsetWidth;
  cartBtn.classList.add('cart-shake');
}

function updateCartQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) cart = cart.filter(c => c.id !== id);
  persistCart();
  renderCartBadge();
  renderCartDrawer();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  persistCart();
  renderCartBadge();
  renderCartDrawer();
}

function renderCartBadge() {
  const badge = document.getElementById('cartBadge');
  const count = cartCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
  if (count > lastCartCount) {
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }
  lastCartCount = count;
}

function renderCartDrawer() {
  const container   = document.getElementById('cartItemsContainer');
  const totalEl      = document.getElementById('cartTotal');
  const whatsappBtn  = document.getElementById('cartWhatsappBtn');

  if (cart.length === 0) {
    container.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
    totalEl.textContent = '$0';
    whatsappBtn.disabled = true;
    return;
  }

  whatsappBtn.disabled = false;
  container.innerHTML = cart.map(item => {
    const imgHtml = item.imagenUrl
      ? `<img class="cart-item-img" src="${driveImgUrl(item.imagenUrl)}" alt="${item.nombre}">`
      : `<div class="cart-item-img"></div>`;
    return `
    <div class="cart-item">
      ${imgHtml}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nombre}</div>
        <div class="cart-item-price">$${item.precio.toLocaleString('es-CL')} c/u</div>
        <div class="cart-item-qty">
          <button class="cart-qty-btn" onclick="updateCartQty('${item.id}',-1)" aria-label="Restar unidad">−</button>
          <span>${item.cantidad}</span>
          <button class="cart-qty-btn" onclick="updateCartQty('${item.id}',1)" aria-label="Sumar unidad">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="Quitar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>
    </div>`;
  }).join('');

  totalEl.textContent = '$' + cartTotal().toLocaleString('es-CL');
}

function toggleCartDrawer() {
  const drawer  = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartDrawerOverlay');
  drawer.classList.toggle('hidden');
  overlay.classList.toggle('hidden');
  if (!drawer.classList.contains('hidden')) renderCartDrawer();
}

function sendCartToWhatsApp() {
  if (cart.length === 0) return;
  const lines = cart.map(item => `- ${item.cantidad}x ${item.nombre} ($${item.precio.toLocaleString('es-CL')} c/u)`);
  const text = `Hola! Quiero hacer este pedido:\n${lines.join('\n')}\n\nTotal: $${cartTotal().toLocaleString('es-CL')}`;
  window.open('https://wa.me/56949809843?text=' + encodeURIComponent(text), '_blank');
}

// ─── Scroll reveal ───────────────────────────────────────────────────────────
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting);
    visible.forEach((entry, i) => {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, i * 50);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.product-card, .section-title').forEach(el => {
    observer.observe(el);
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}
