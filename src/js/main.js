// ===================== STATE WIDGET RENDERER =====================
// statesData is injected as a global <script> var by the build system

function renderStateWidget(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;

    // Normalise CMS field names to the widget's expected shape
    // CMS uses: state_name, ok(bool), text  →  widget uses: name, ok, t
    const normalised = (statesData || []).map(s => ({
        name: s.state_name || s.name || '',
        act: s.act || '',
        status: s.status || 'old',
        deposit: s.deposit || '',
        notice: s.notice || '',
        authority: s.authority || '',
        tags: s.tags || [],
        rights: (s.rights || []).map(r => ({
            ok: r.ok !== undefined ? r.ok : true,
            t: r.text || r.t || ''
        })),
        link: s.link || '',
        lt: s.link_text || s.lt || 'Read more'
    }));

    // Store normalised data globally for filter/tab functions
    window._swData = window._swData || {};
    window._swData[containerId] = normalised;

    c.innerHTML = `
    <p class="sw-intro">India has no single national rent law. Every state has its own Act. Find yours below — in plain language.</p>
    <div class="sw-legend">
      <div class="sw-legend-item"><div class="sw-dot" style="background:#4ade80"></div> MTA Adopted</div>
      <div class="sw-legend-item"><div class="sw-dot" style="background:#fbbf24"></div> Older act</div>
      <div class="sw-legend-item"><div class="sw-dot" style="background:#60a5fa"></div> In transition</div>
    </div>
    <input class="sw-search" type="text" placeholder="Search your state..." id="${containerId}-search" oninput="filterSW('${containerId}')"/>
    <div class="sw-tabs">
      <div class="sw-tab active" onclick="tabSW('${containerId}','all',this)">All states</div>
      <div class="sw-tab" onclick="tabSW('${containerId}','mta',this)">MTA adopted</div>
      <div class="sw-tab" onclick="tabSW('${containerId}','old',this)">Older acts</div>
      <div class="sw-tab" onclick="tabSW('${containerId}','partial',this)">In transition</div>
    </div>
    <div id="${containerId}-list"></div>
  `;
    renderSWList(containerId, normalised);
}

function renderSWList(cid, list) {
    const el = document.getElementById(cid + '-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="sw-no-results">No states found.</div>'; return; }
    el.innerHTML = list.map((s, i) => {
        const bClass = s.status === 'mta' ? 'sw-badge-mta' : s.status === 'old' ? 'sw-badge-old' : 'sw-badge-partial';
        const bText = s.status === 'mta' ? 'MTA adopted' : s.status === 'old' ? 'Older act' : 'In transition';
        return `<div class="sw-card">
      <div class="sw-card-header" onclick="toggleSW('${cid}-${i}')">
        <div><div class="sw-state-name">${s.name}</div><div class="sw-state-act">${s.act}</div></div>
        <div class="sw-header-right"><span class="sw-badge ${bClass}">${bText}</span><span class="sw-chevron" id="sc-${cid}-${i}">▼</span></div>
      </div>
      <div class="sw-body" id="sb-${cid}-${i}">
        <div class="sw-grid">
          <div class="sw-metric"><div class="sw-metric-label">Max deposit</div><div class="sw-metric-value">${s.deposit}</div></div>
          <div class="sw-metric"><div class="sw-metric-label">Eviction notice</div><div class="sw-metric-value">${s.notice}</div></div>
        </div>
        <div class="sw-metric" style="margin-bottom:10px"><div class="sw-metric-label">Dispute forum</div><div class="sw-metric-value">${s.authority}</div></div>
        <div class="sw-pills">${(s.tags || []).map(t => `<span class="sw-pill">${t}</span>`).join('')}</div>
        <div class="sw-rights-label">Your rights</div>
        ${(s.rights || []).map(r => `<div class="sw-right"><span class="${r.ok ? 'sw-ok' : 'sw-warn'}">${r.ok ? '✓' : '!'}</span><span>${r.t}</span></div>`).join('')}
        <a class="sw-link" href="${s.link}" target="_blank">${s.lt} →</a>
      </div>
    </div>`;
    }).join('');
}

function toggleSW(id) {
    const b = document.getElementById('sb-' + id);
    const c = document.getElementById('sc-' + id);
    if (b) b.classList.toggle('open');
    if (c) c.classList.toggle('open');
}

window._swTabs = {};
function tabSW(cid, tab, el) {
    window._swTabs[cid] = tab;
    el.closest('.sw-tabs').querySelectorAll('.sw-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    filterSW(cid);
}

function filterSW(cid) {
    const q = (document.getElementById(cid + '-search') || {}).value || '';
    const tab = window._swTabs[cid] || 'all';
    const data = (window._swData && window._swData[cid]) || [];
    const list = data.filter(s => {
        const mt = tab === 'all' || s.status === tab;
        const ms = !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.act.toLowerCase().includes(q.toLowerCase());
        return mt && ms;
    });
    renderSWList(cid, list);
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
