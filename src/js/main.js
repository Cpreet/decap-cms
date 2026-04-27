// ===================== STATE WIDGET RENDERER =====================
// statesData is injected as a global <script> var by the build system

function renderStateWidget(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;

  const states = (statesData || []).map(s => ({
    name: s.state_name || '',
    excerpt: s.excerpt || '',
    links: (s.links || []).map(l => ({ text: l.text || 'Read more', url: l.url || '' }))
  }));

  c.innerHTML = `
    <div class="sw-grid">${states.map(s => `<div class="sw-card">
        <div class="sw-card-header">
          <span class="sw-state-name">${s.name}</span>
        </div>
        <p class="sw-excerpt">${s.excerpt}</p>
        <div class="sw-links">${s.links.map(l => `<a class="sw-link" href="${l.url}" target="_blank">${l.text} <i data-lucide="arrow-right" style="vertical-align:middle"></i></a>`).join('')}</div>
      </div>`).join('')}</div>`;
  if (window.lucide) lucide.createIcons();
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
  // Lazy init testimonial players on first journal visit
  if (id === 'journal') {
    if (window.WaveSurfer) initAllTestimonialPlayers();
    else window.addEventListener('load', initAllTestimonialPlayers, { once: true });
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
    <div class="card-location"><i data-lucide="map-pin" style="width:14px;height:14px"></i> ${escapeHTML(p.location)}</div>
    <div class="card-badge">${escapeHTML(p.issue_type)}</div>
    <p>${escapeHTML(p.body)}</p>
    <div class="card-footer">
      <button class="upvote-btn ${voted ? 'voted' : ''}" onclick="upvote(this)"><i data-lucide="arrow-up" style="width:18px;height:18px"></i><span>${p.upvotes || 0}</span></button>
      <button class="share-btn" onclick="showToast('Link copied!')"><i data-lucide="share-2" style="width:18px;height:18px"></i></button>
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
  if (window.lucide) lucide.createIcons();
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

// ===================== TESTIMONIAL PLAYER =====================
function parseVTT(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const cues = [];
  let i = 0;
  if (lines[i] && lines[i].trim().startsWith('WEBVTT')) i++;
  const tsToSec = (t) => {
    const parts = t.split(':');
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) { h = +parts[0]; m = +parts[1]; s = parseFloat(parts[2]); }
    else if (parts.length === 2) { m = +parts[0]; s = parseFloat(parts[1]); }
    else { s = parseFloat(parts[0]); }
    return h * 3600 + m * 60 + s;
  };
  while (i < lines.length) {
    while (i < lines.length && !lines[i].includes('-->')) i++;
    if (i >= lines.length) break;
    const m = lines[i].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!m) { i++; continue; }
    const start = tsToSec(m[1]);
    const end = tsToSec(m[2]);
    i++;
    const txt = [];
    while (i < lines.length && lines[i].trim() !== '') { txt.push(lines[i]); i++; }
    cues.push({ start, end, text: txt.join('\n').trim() });
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return cues;
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

function splitSpeaker(text) {
  // Match leading "Speaker N:" or "Name:" at start
  const m = text.match(/^([^\n:]{1,40}):\s*([\s\S]*)$/);
  if (m && /speaker\s*\d+|^[A-Z][A-Za-z .'\-]+$/i.test(m[1].trim())) {
    return { speaker: m[1].trim(), text: m[2].trim() };
  }
  return { speaker: '', text };
}

const _testimonialPlayers = new WeakSet();

function initTestimonialPlayer(root) {
  if (_testimonialPlayers.has(root)) return;
  _testimonialPlayers.add(root);

  const audioEl = root.querySelector('[data-tp-audio]');
  const playBtn = root.querySelector('[data-tp-play]');
  const muteBtn = root.querySelector('[data-tp-mute]');
  const curEl = root.querySelector('[data-tp-current]');
  const durEl = root.querySelector('[data-tp-duration]');
  const waveEl = root.querySelector('[data-tp-waveform]');
  const transcriptEl = root.querySelector('[data-tp-transcript]');
  const audioUrl = root.dataset.audio;
  const vttUrl = root.dataset.vtt;

  let ws = null;
  if (window.WaveSurfer && waveEl && audioUrl) {
    try {
      ws = WaveSurfer.create({
        container: waveEl,
        waveColor: 'rgba(255,255,255,0.25)',
        progressColor: '#f59f0a',
        cursorColor: '#f59f0a',
        cursorWidth: 1,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        height: waveEl.clientHeight || 48,
        normalize: true,
        url: audioUrl,
        media: audioEl,
      });
    } catch (e) { ws = null; }
  }

  // Fallback progress bar if no wavesurfer
  if (!ws && waveEl) {
    waveEl.classList.add('tp-waveform-fallback');
    waveEl.addEventListener('click', (e) => {
      const r = waveEl.getBoundingClientRect();
      const ratio = (e.clientX - r.left) / r.width;
      if (audioEl.duration) audioEl.currentTime = ratio * audioEl.duration;
    });
  }

  // Play / pause
  function setPlayIcon(isPlaying) {
    const icon = playBtn.querySelector('svg, [data-lucide]');
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause testimonial' : 'Play testimonial');
    playBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    if (icon) {
      icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
      if (window.lucide) lucide.createIcons();
    }
  }
  playBtn.addEventListener('click', () => {
    if (audioEl.paused) audioEl.play(); else audioEl.pause();
  });
  audioEl.addEventListener('play', () => setPlayIcon(true));
  audioEl.addEventListener('pause', () => setPlayIcon(false));
  audioEl.addEventListener('ended', () => setPlayIcon(false));

  // Mute
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      audioEl.muted = !audioEl.muted;
      const icon = muteBtn.querySelector('svg, [data-lucide]');
      if (icon) {
        icon.setAttribute('data-lucide', audioEl.muted ? 'volume-x' : 'volume-2');
        if (window.lucide) lucide.createIcons();
      }
      muteBtn.setAttribute('aria-label', audioEl.muted ? 'Unmute' : 'Mute');
    });
  }

  // Time display
  function updateTimes() {
    if (curEl) curEl.textContent = fmtTime(audioEl.currentTime);
    if (durEl && audioEl.duration) durEl.textContent = fmtTime(audioEl.duration);
  }
  audioEl.addEventListener('loadedmetadata', updateTimes);
  audioEl.addEventListener('timeupdate', updateTimes);

  // Fallback progress var
  audioEl.addEventListener('timeupdate', () => {
    if (!ws && waveEl && audioEl.duration) {
      waveEl.style.setProperty('--progress', ((audioEl.currentTime / audioEl.duration) * 100) + '%');
    }
  });

  // Transcript
  let cues = [];
  let activeIdx = -1;

  function renderCues() {
    transcriptEl.innerHTML = '';
    cues.forEach((c, idx) => {
      const li = document.createElement('li');
      li.className = 'tp-cue';
      li.dataset.idx = idx;
      const { speaker, text } = splitSpeaker(c.text);
      const time = document.createElement('span');
      time.className = 'tp-cue-time';
      time.textContent = fmtTime(c.start);
      li.appendChild(time);
      if (speaker) {
        const sp = document.createElement('span');
        sp.className = 'tp-cue-speaker';
        sp.textContent = speaker;
        li.appendChild(sp);
      }
      const txt = document.createElement('span');
      txt.className = 'tp-cue-text';
      txt.textContent = text;
      li.appendChild(txt);
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      const jump = () => {
        if (ws && typeof ws.setTime === 'function') ws.setTime(c.start);
        else audioEl.currentTime = c.start;
        audioEl.play();
        setActive(idx);
      };
      li.addEventListener('click', jump);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); }
      });
      transcriptEl.appendChild(li);
    });
  }

  function findActive(t) {
    if (!cues.length) return -1;
    let lo = 0, hi = cues.length - 1, res = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= t) { res = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (res >= 0 && cues[res].end < t - 0.5 && (res === cues.length - 1 || cues[res + 1].start > t + 0.5)) {
      // gap — keep showing the previous one
    }
    return res;
  }

  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    const items = transcriptEl.querySelectorAll('.tp-cue');
    items.forEach((el) => {
      const i = Number(el.dataset.idx);
      const d = idx < 0 ? 99 : Math.abs(i - idx);
      el.classList.toggle('tp-cue-active', d === 0);
      if (d === 0) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
      el.dataset.dist = d > 9 ? '9' : String(d);
    });
    if (idx < 0) return;
    const el = transcriptEl.querySelector('[data-idx="' + idx + '"]');
    if (el) {
      const cRect = transcriptEl.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const delta = (eRect.top + eRect.height / 2) - (cRect.top + cRect.height / 2);
      transcriptEl.scrollTo({ top: transcriptEl.scrollTop + delta, behavior: 'smooth' });
    }
  }

  function getTime() {
    if (ws && typeof ws.getCurrentTime === 'function') {
      const wt = ws.getCurrentTime();
      if (wt > 0) return wt;
    }
    return audioEl.currentTime || 0;
  }
  function syncActive() {
    if (!cues.length) return;
    setActive(findActive(getTime()));
  }
  let rafId = null;
  function tick() {
    syncActive();
    rafId = requestAnimationFrame(tick);
  }
  function startTick() { if (rafId == null) rafId = requestAnimationFrame(tick); }
  function stopTick() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } syncActive(); }
  audioEl.addEventListener('play', startTick);
  audioEl.addEventListener('pause', stopTick);
  audioEl.addEventListener('ended', stopTick);
  audioEl.addEventListener('seeked', syncActive);
  audioEl.addEventListener('timeupdate', syncActive);
  if (ws) {
    ws.on('play', startTick);
    ws.on('pause', stopTick);
    ws.on('finish', stopTick);
    ws.on('seeking', syncActive);
    ws.on('ready', syncActive);
  }

  if (vttUrl && transcriptEl) {
    fetch(vttUrl).then(r => r.ok ? r.text() : Promise.reject()).then(t => {
      cues = parseVTT(t);
      if (!cues.length) {
        transcriptEl.innerHTML = '<li class="tp-cue tp-cue-loading">Transcript could not be parsed.</li>';
        return;
      }
      renderCues();
      setActive(0);
    }).catch(() => {
      transcriptEl.innerHTML = '<li class="tp-cue tp-cue-loading">Transcript unavailable.</li>';
    });
  }
}

function initAllTestimonialPlayers() {
  document.querySelectorAll('[data-testimonial-player]').forEach(initTestimonialPlayer);
}

// ===================== INIT =====================
showPage('home');
