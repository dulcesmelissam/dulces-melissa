const API_URL = 'https://script.google.com/macros/s/AKfycbwzZ3FQ-AfE4r9HgvSdsHCYsf9CtzbYY7hN3bakiYQH-FdAeoYO_B-l0NzfLsLnk0Fm/exec';

// ─── State ────────────────────────────────────────────────────────────────────
let allProducts     = [];
let activeFilter     = 'all';
let searchQuery       = '';
let lastLoadTime     = 0;
let bestSellerCodes  = [];
let currentView      = 'home';

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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
    <article class="product-card" id="card-${p.id}" style="animation-delay:${idx * 0.05}s">
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
