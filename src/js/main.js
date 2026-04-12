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
    <p class="sw-intro">India has no single national rent law. Every state has its own Act. Find yours below — in plain language.</p>
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
        <div class="sw-links">${s.links.map(l => `<a class="sw-link" href="${l.url}" target="_blank">${l.text} &rarr;</a>`).join('')}</div>
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
}

// ===================== MOBILE MENU =====================
function toggleMenu() {
    document.getElementById('mobile-menu').classList.toggle('open');
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
function upvote(btn) {
    btn.classList.toggle('voted');
    const num = btn.querySelector('span:last-child');
    num.textContent = parseInt(num.textContent) + (btn.classList.contains('voted') ? 1 : -1);
}

function postWallWarning() {
    const city = document.getElementById('wall-city').value.trim();
    const issue = document.getElementById('wall-issue').value;
    const msg = document.getElementById('wall-msg').value.trim();
    if (!city || !issue || !msg) { showToast('Please fill in all fields before posting.'); return; }
    const container = document.getElementById('wall-cards');
    const labels = { deposit: 'Deposit Withholding', eviction: 'Illegal Eviction', harassment: 'Landlord Harassment', hike: 'Arbitrary Rent Hike', discrimination: 'Discrimination', rwa: 'RWA Discrimination', other: 'Other Violation' };
    const card = document.createElement('div');
    card.className = 'wall-card wall-card-normal';
    card.innerHTML = `
    <div class="card-location"><span class="material-symbols-outlined" style="font-size:14px">location_on</span> ${city} · just now</div>
    <div class="card-badge">${labels[issue] || issue}</div>
    <p>${msg}</p>
    <div class="card-footer">
      <button class="upvote-btn" onclick="upvote(this)"><span class="material-symbols-outlined" style="font-size:18px">arrow_upward</span><span>0</span></button>
      <button class="share-btn" onclick="showToast('Link copied!')"><span class="material-symbols-outlined" style="font-size:18px">share</span></button>
    </div>`;
    container.insertBefore(card, container.firstChild);
    document.getElementById('wall-city').value = '';
    document.getElementById('wall-issue').value = '';
    document.getElementById('wall-msg').value = '';
    showToast('Warning posted anonymously.');
}

function sortWall(type, el) {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    showToast(type === 'upvoted' ? 'Sorted by most upvoted.' : 'Sorted by latest.');
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
