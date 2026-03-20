// ============================================================
// ADMIN — enter results, manage rounds, lock predictions
// ============================================================

let adminResults = {};
let adminCurrentRound = 1;
let adminFullBracketLocked = false;
let adminRoundPredictionsLocked = false;

const ADMIN_ALL_SERIES = [
  { id:'w1',   name:'Запад 1 vs 8',  round:1 },
  { id:'w2',   name:'Запад 2 vs 7',  round:1 },
  { id:'w3',   name:'Запад 3 vs 6',  round:1 },
  { id:'w4',   name:'Запад 4 vs 5',  round:1 },
  { id:'e1',   name:'Восток 1 vs 8', round:1 },
  { id:'e2',   name:'Восток 2 vs 7', round:1 },
  { id:'e3',   name:'Восток 3 vs 6', round:1 },
  { id:'e4',   name:'Восток 4 vs 5', round:1 },
  { id:'c1',   name:'Кросс: W1–E4',  round:2 },
  { id:'c2',   name:'Кросс: E2–W3',  round:2 },
  { id:'c3',   name:'Кросс: E1–W4',  round:2 },
  { id:'c4',   name:'Кросс: W2–E3',  round:2 },
  { id:'s1',   name:'Полуфинал 1',   round:3 },
  { id:'s2',   name:'Полуфинал 2',   round:3 },
  { id:'final',name:'Финал КГ',      round:4 }
];

const ADMIN_TREE = {
  'c1':['w1','e4'], 'c2':['e2','w3'],
  'c3':['e1','w4'], 'c4':['w2','e3'],
  's1':['c1','c2'], 's2':['c3','c4'],
  'final':['s1','s2']
};

function getTeamOptions(sid) {
  if (ADMIN_TREE[sid]) {
    const kids = ADMIN_TREE[sid];
    return kids.map(id => adminResults[id]?.winner || '?').filter(t => t !== '?');
  }
  // R1
  const r1W = BRACKET.west.r1.find(s => s.id === sid);
  if (r1W) return [r1W.home, r1W.away];
  const r1E = BRACKET.east.r1.find(s => s.id === sid);
  if (r1E) return [r1E.home, r1E.away];
  return [];
}

// ── Load ─────────────────────────────────────────────────
async function loadAdminData() {
  const snap = await db.collection('settings').doc('results').get();
  if (snap.exists) {
    adminResults                = snap.data().series || {};
    adminCurrentRound           = snap.data().currentRound || 1;
    adminFullBracketLocked      = snap.data().fullBracketLocked || false;
    adminRoundPredictionsLocked = snap.data().roundPredictionsLocked || false;
  }
}

// ── Save all ──────────────────────────────────────────────
async function saveAdminData() {
  const btn = document.getElementById('save-admin-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Сохранение…';
  try {
    await db.collection('settings').doc('results').set({
      series:                   adminResults,
      currentRound:             adminCurrentRound,
      fullBracketLocked:        adminFullBracketLocked,
      roundPredictionsLocked:   adminRoundPredictionsLocked,
      updatedAt:                firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Результаты сохранены!', 'success');
    renderAdminPanel();
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить всё';
  }
}

// ── Render ────────────────────────────────────────────────
function renderAdminPanel() {
  renderRoundControl();
  renderLockControl();
  renderSeriesList();
  renderParticipants();
}

function renderRoundControl() {
  const sel = document.getElementById('current-round-sel');
  if (!sel) return;
  sel.value = adminCurrentRound;
}

function renderLockControl() {
  const cb = document.getElementById('lock-full-bracket');
  if (cb) cb.checked = adminFullBracketLocked;
  const cb2 = document.getElementById('lock-round-predictions');
  if (cb2) cb2.checked = adminRoundPredictionsLocked;
}

function renderSeriesList() {
  const container = document.getElementById('admin-series-list');
  if (!container) return;

  const byRound = [[], [], [], []];
  ADMIN_ALL_SERIES.forEach(s => byRound[s.round - 1].push(s));

  container.innerHTML = byRound.map((group, ri) => `
    <div style="margin-bottom:2rem">
      <h3 style="font-family:'Oswald',sans-serif;font-size:1rem;color:var(--text-2);
                 text-transform:uppercase;letter-spacing:.06em;
                 border-bottom:1px solid var(--border);padding-bottom:.5rem;margin-bottom:.75rem">
        ${ROUND_NAMES[ri]}
        ${ri === 1 ? ' <span style="font-size:.75rem;color:var(--text-3);font-weight:400">(перекрёстный)</span>' : ''}
      </h3>
      ${group.map(s => buildAdminSeriesRow(s)).join('')}
    </div>
  `).join('');

  // Wire events
  container.querySelectorAll('.admin-winner-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      const sid = sel.dataset.sid;
      if (!adminResults[sid]) adminResults[sid] = {};
      adminResults[sid].winner = sel.value || null;
    });
  });
  container.querySelectorAll('.admin-score-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      const sid = sel.dataset.sid;
      if (!adminResults[sid]) adminResults[sid] = {};
      adminResults[sid].score = sel.value || null;
    });
  });
  container.querySelectorAll('.admin-complete-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const sid = cb.dataset.sid;
      if (!adminResults[sid]) adminResults[sid] = {};
      adminResults[sid].complete = cb.checked;
    });
  });
}

function buildAdminSeriesRow(s) {
  const sid     = s.id;
  const result  = adminResults[sid] || {};
  const teams   = getTeamOptions(sid);
  const teamOpts = teams.map(t =>
    `<option value="${t}"${result.winner === t ? ' selected' : ''}>${t}</option>`
  ).join('');

  const scoreOpts = ['4:0','4:1','4:2','4:3'].map(s =>
    `<option value="${s}"${result.score === s ? ' selected' : ''}>${s}</option>`
  ).join('');

  const hasBothTeams = teams.length === 2;

  return `
    <div class="admin-series-item">
      <div class="admin-series-name">${s.name}</div>
      <div class="admin-series-controls">
        ${hasBothTeams ? `
          <select class="admin-select admin-winner-sel" data-sid="${sid}">
            <option value="">— Победитель —</option>
            ${teamOpts}
          </select>
          <select class="admin-select admin-score-sel" data-sid="${sid}">
            <option value="">— Счёт —</option>
            ${scoreOpts}
          </select>
          <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;color:var(--text-2);cursor:pointer">
            <input type="checkbox" class="admin-complete-cb" data-sid="${sid}"
              ${result.complete ? 'checked' : ''}>
            Серия завершена
          </label>
          ${result.complete ? '<span class="complete-badge">✓ Завершена</span>' : ''}
        ` : `<span style="color:var(--text-3);font-size:.85rem">Ожидание предыдущих результатов…</span>`}
      </div>
    </div>
  `;
}

// ── Participants ────────────────────────────────────────────
async function renderParticipants() {
  const container = document.getElementById('participants-list');
  if (!container) return;

  container.innerHTML = '<div class="loading-overlay" style="padding:1rem"><div class="spinner"></div></div>';

  try {
    const usersSnap = await db.collection('users').get();
    const predsSnap = await db.collection('predictions').get();
    const predMap = {};
    predsSnap.forEach(doc => {
      const d = doc.data();
      predMap[doc.id] = {
        hasFull:  !!d.fullBracket,
        hasRound: !!d.roundPredictions
      };
    });

    if (usersSnap.empty) {
      container.innerHTML = '<div style="color:var(--text-3);padding:1rem;font-size:.85rem">Нет зарегистрированных участников.</div>';
      return;
    }

    let rows = [];
    usersSnap.forEach(doc => {
      const u = doc.data();
      const pred = predMap[doc.id] || {};
      rows.push({
        uid: doc.id,
        username: u.username || 'Аноним',
        email: u.email || '—',
        isAdmin: u.isAdmin || false,
        hasFull: pred.hasFull,
        hasRound: pred.hasRound
      });
    });

    rows.sort((a, b) => a.username.localeCompare(b.username));

    container.innerHTML = `
      <div style="font-size:.78rem;color:var(--text-3);margin-bottom:.5rem">
        Всего участников: ${rows.length}
      </div>
      <div class="participants-grid">
        ${rows.map(r => `
          <div class="admin-series-item" style="padding:.65rem 1rem">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.9rem">${escapeHtmlAdmin(r.username)}${r.isAdmin ? ' <span style="color:var(--gold);font-size:.7rem">ADMIN</span>' : ''}</div>
              <div style="font-size:.75rem;color:var(--text-3)">${escapeHtmlAdmin(r.email)}</div>
            </div>
            <div style="display:flex;gap:.5rem;flex-shrink:0">
              ${r.hasFull  ? '<span class="complete-badge" style="font-size:.65rem">Полная сетка</span>' : ''}
              ${r.hasRound ? '<span class="complete-badge" style="font-size:.65rem">По раундам</span>' : ''}
              ${!r.hasFull && !r.hasRound ? '<span style="font-size:.75rem;color:var(--text-3)">Нет прогноза</span>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">Ошибка загрузки: ${e.message}</div>`;
  }
}

function escapeHtmlAdmin(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
async function initAdmin() {
  await loadAdminData();
  renderAdminPanel();

  document.getElementById('current-round-sel')?.addEventListener('change', e => {
    adminCurrentRound = parseInt(e.target.value);
  });

  document.getElementById('lock-full-bracket')?.addEventListener('change', e => {
    adminFullBracketLocked = e.target.checked;
  });
  document.getElementById('lock-round-predictions')?.addEventListener('change', e => {
    adminRoundPredictionsLocked = e.target.checked;
  });

  document.getElementById('save-admin-btn')?.addEventListener('click', saveAdminData);
}
