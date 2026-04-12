// ===================== STATE WIDGET RENDERER =====================
// statesData is injected as a global <script> var by the build system

function renderStateWidget(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;

  const states = (statesData || []).map(s => ({
    name: s.state_name || '',
    status: s.status || 'old',
    excerpt: s.excerpt || '',
    links: (s.links || []).map(l => ({ text: l.text || 'Read more', url: l.url || '' }))
  }));

  const bInfo = s => s === 'mta' ? ['sw-badge-mta', 'MTA adopted'] : s === 'old' ? ['sw-badge-old', 'Older act'] : ['sw-badge-partial', 'In transition'];

  c.innerHTML = `
    <div class="sw-legend">
      <div class="sw-legend-item"><div class="sw-dot" style="background:#4ade80"></div> MTA Adopted</div>
      <div class="sw-legend-item"><div class="sw-dot" style="background:#fbbf24"></div> Older act</div>
      <div class="sw-legend-item"><div class="sw-dot" style="background:#60a5fa"></div> In transition</div>
    </div>
    <div class="sw-grid">${states.map(s => {
    const [bc, bt] = bInfo(s.status);
    return `<div class="sw-card">
        <div class="sw-card-header">
          <span class="sw-state-name">${s.name}</span>
          <span class="sw-badge ${bc}">${bt}</span>
        </div>
        <p class="sw-excerpt">${s.excerpt}</p>
        <div class="sw-links">${s.links.map(l => `<a class="sw-link" href="${l.url}" target="_blank">${l.text} <span class="material-symbols-outlined" style="font-size:inherit;vertical-align:middle">arrow_forward</span></a>`).join('')}</div>
      </div>`;
  }).join('')}</div>`;
}

// ===================== PAGE ROUTING =====================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) { page.classList.add('active'); window.scrollTo(0, 0); }
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === id);
  });
  // Init state widget on rights page
  if (id === 'rights' && !document.getElementById('state-widget-kyr').innerHTML) {
    renderStateWidget('state-widget-kyr');
  }
  // Load community wall posts on first visit
  if (id === 'wall' && !window._wallLoaded) {
    window._wallLoaded = true;
    loadWallPosts();
  }
  // Show floater only on homepage
  const floater = document.getElementById('action-floater');
  if (floater) {
    floater.classList.toggle('visible', id === 'home');
    floater.classList.remove('open');
  }
}

// ===================== MOBILE MENU =====================
function toggleMenu() {
  const open = document.getElementById('mobile-menu').classList.toggle('open');
  const floater = document.getElementById('action-floater');
  if (floater) floater.classList.toggle('menu-hidden', open);
}

// ===================== KYR SIDEBAR =====================
function scrollKYR(section, el) {
  document.querySelectorAll('.sidebar-link').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
  const target = document.getElementById('kyr-' + section);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===================== KYR SEARCH =====================
function filterKYR(q) {
  const ql = q.toLowerCase();
  document.querySelectorAll('.kyr-section').forEach(s => {
    if (!ql) { s.style.display = ''; return; }
    const text = s.textContent.toLowerCase();
    s.style.display = text.includes(ql) ? '' : 'none';
  });
}

// ===================== WALL FUNCTIONS =====================
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function votedIds() {
  try { return JSON.parse(localStorage.getItem('wall_voted') || '[]'); } catch { return []; }
}
function setVotedIds(ids) {
  try { localStorage.setItem('wall_voted', JSON.stringify(ids)); } catch {}
}

function renderWallPost(p) {
  const voted = votedIds().includes(p.id);
  return `<div class="wall-card" data-id="${p.id}">
    <div class="card-location"><span class="material-symbols-outlined" style="font-size:14px">location_on</span> ${escapeHTML(p.location)}</div>
    <div class="card-badge">${escapeHTML(p.issue_type)}</div>
    <p>${escapeHTML(p.body)}</p>
    <div class="card-footer">
      <button class="upvote-btn ${voted ? 'voted' : ''}" onclick="upvote(this)"><span class="material-symbols-outlined" style="font-size:18px">arrow_upward</span><span>${p.upvotes || 0}</span></button>
      <button class="share-btn" onclick="showToast('Link copied!')"><span class="material-symbols-outlined" style="font-size:18px">share</span></button>
    </div>
  </div>`;
}

window._wallPosts = [];
window._wallSort = 'latest';

function sortWallPosts() {
  const sorted = [...window._wallPosts];
  if (window._wallSort === 'upvoted') sorted.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  else sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return sorted;
}

function renderWall() {
  const container = document.getElementById('wall-cards');
  if (!container) return;
  const dynamic = sortWallPosts().map(renderWallPost).join('');
  // Preserve any server-rendered illustrative cards by appending community posts above them
  const illustrative = container.querySelectorAll('.wall-card:not([data-id])');
  container.innerHTML = dynamic + Array.from(illustrative).map(el => el.outerHTML).join('');
}

async function loadWallPosts() {
  try {
    const res = await fetch('/api/wall-posts');
    if (!res.ok) return;
    const data = await res.json();
    window._wallPosts = data.posts || [];
    renderWall();
  } catch (e) { /* silent; illustrative cards remain */ }
}

async function upvote(btn) {
  const card = btn.closest('.wall-card');
  const id = card && card.dataset.id;
  const num = btn.querySelector('span:last-child');
  if (!id) {
    // Illustrative/local card — just toggle visually
    btn.classList.toggle('voted');
    num.textContent = parseInt(num.textContent) + (btn.classList.contains('voted') ? 1 : -1);
    return;
  }
  const voted = votedIds();
  const alreadyVoted = voted.includes(id);
  const delta = alreadyVoted ? -1 : 1;
  // Optimistic update
  btn.classList.toggle('voted', !alreadyVoted);
  num.textContent = Math.max(0, parseInt(num.textContent) + delta);
  const next = alreadyVoted ? voted.filter(v => v !== id) : [...voted, id];
  setVotedIds(next);
  try {
    const res = await fetch('/api/wall-upvote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, delta }),
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    num.textContent = data.upvotes;
    const post = window._wallPosts.find(p => p.id === id);
    if (post) post.upvotes = data.upvotes;
  } catch {
    // Revert on failure
    btn.classList.toggle('voted', alreadyVoted);
    num.textContent = Math.max(0, parseInt(num.textContent) - delta);
    setVotedIds(voted);
    showToast('Could not record vote. Try again.');
  }
}

async function postWallWarning() {
  const cityEl = document.getElementById('wall-city');
  const issueEl = document.getElementById('wall-issue');
  const msgEl = document.getElementById('wall-msg');
  const city = cityEl.value.trim();
  const issue = issueEl.value;
  const msg = msgEl.value.trim();
  if (!city || !issue || !msg) { showToast('Please fill in all fields before posting.'); return; }

  const btn = document.querySelector('.form-submit');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/wall-posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ location: city, issue_type: issue, body: msg }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'failed');
    }
    const data = await res.json();
    window._wallPosts.unshift(data.post);
    cityEl.value = '';
    issueEl.value = '';
    msgEl.value = '';
    renderWall();
    // Hide the illustrative notice if present
    const notice = document.querySelector('#page-wall .wall-notice');
    if (notice) notice.style.display = 'none';
    showToast('Warning posted anonymously.');
  } catch (e) {
    showToast('Could not post warning. Try again.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function sortWall(type, el) {
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  window._wallSort = type;
  renderWall();
}

// ===================== TOAST =====================
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===================== PROGRESS BAR =====================
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const p = h > 0 ? (window.scrollY / h) * 100 : 0;
  document.getElementById('progress').style.width = Math.round(p) + '%';
});

// ===================== INIT =====================
showPage('home');
