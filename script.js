const API_URL = 'https://script.google.com/macros/s/AKfycbwzZ3FQ-AfE4r9HgvSdsHCYsf9CtzbYY7hN3bakiYQH-FdAeoYO_B-l0NzfLsLnk0Fm/exec';

let allProducts  = [];
let activeFilter = 'all';
let searchQuery  = '';
let lastLoadTime = 0;

document.addEventListener('DOMContentLoaded', loadProducts);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - lastLoadTime > 2 * 60 * 1000) {
    loadProducts();
  }
});

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
      document.getElementById('catalogContainer').classList.remove('hidden');
    })
    .catch(() => {
      document.getElementById('loadingSpinner').classList.add('hidden');
      showToast('Error al cargar productos', 'error');
    });
}

function setSearchQuery(value) {
  searchQuery = value.trim().toLowerCase();
  renderCatalog();
}

function renderCatalog() {
  const container = document.getElementById('catalogContainer');
  let list = activeFilter === 'all'
    ? allProducts
    : allProducts.filter(p => p.categoria === activeFilter);

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

  return `
    <article class="product-card" style="animation-delay:${idx * 0.06}s">
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
        ${p.stockCajas != null ? `
        <div class="product-stock">
          <span class="product-stock-label">Disponible:</span>
          <span class="product-stock-value">${p.stockCajas}</span>
        </div>` : ''}
      </div>
    </article>`;
}

function renderFilterTabs() {
  const cats = [...new Set(allProducts.map(p => p.categoria))];
  const tabs = [
    { f: 'all', l: 'Todos', count: allProducts.length },
    ...cats.map(c => ({ f: c, l: c, count: allProducts.filter(p => p.categoria === c).length }))
  ];

  document.getElementById('filterTabsContainer').innerHTML = `
    <div class="filter-tabs">
      ${tabs.map(t => `
        <button class="filter-tab${t.f === activeFilter ? ' active' : ''}"
                data-filter="${t.f}"
                onclick="setFilter('${t.f}')">
          ${t.l} <span class="filter-count">${t.count}</span>
        </button>`).join('')}
    </div>`;
}

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderCatalog();
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting);
    visible.forEach((entry, i) => {
      setTimeout(() => entry.target.classList.add('visible'), i * 55);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.product-card, .section-title').forEach(el => {
    observer.observe(el);
  });
}

let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}
