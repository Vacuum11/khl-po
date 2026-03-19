// ============================================================
// ADMIN — enter results, manage rounds, lock predictions
// ============================================================

let adminResults = {};
let adminCurrentRound = 1;
let adminFullBracketLocked = false;

const ADMIN_ALL_SERIES = [
  { id:'w1',   name:'Запад 1',  round:1 },
  { id:'w2',   name:'Запад 2',  round:1 },
  { id:'w3',   name:'Запад 3',  round:1 },
  { id:'w4',   name:'Запад 4',  round:1 },
  { id:'e1',   name:'Восток 1', round:1 },
  { id:'e2',   name:'Восток 2', round:1 },
  { id:'e3',   name:'Восток 3', round:1 },
  { id:'e4',   name:'Восток 4', round:1 },
  { id:'w1w2', name:'Запад 1/4 (1-2)', round:2 },
  { id:'w3w4', name:'Запад 1/4 (3-4)', round:2 },
  { id:'e1e2', name:'Восток 1/4 (1-2)',round:2 },
  { id:'e3e4', name:'Восток 1/4 (3-4)',round:2 },
  { id:'wf',   name:'Финал Запада',    round:3 },
  { id:'ef',   name:'Финал Востока',   round:3 },
  { id:'final',name:'Финал КГ',        round:4 }
];

// Map bracket R1 to team options
function getTeamOptions(sid) {
  const tree = {
    'w1w2':['w1','w2'],'w3w4':['w3','w4'],
    'e1e2':['e1','e2'],'e3e4':['e3','e4'],
    'wf':['w1w2','w3w4'],'ef':['e1e2','e3e4'],
    'final':['wf','ef']
  };

  const getWinners = (ids) => ids.map(id => adminResults[id]?.winner || '?').filter(t => t !== '?');

  if (tree[sid]) {
    const kids = tree[sid];
    return getWinners(kids);
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
    adminResults           = snap.data().series || {};
    adminCurrentRound      = snap.data().currentRound || 1;
    adminFullBracketLocked = snap.data().fullBracketLocked || false;
  }
}

// ── Save all ──────────────────────────────────────────────
async function saveAdminData() {
  const btn = document.getElementById('save-admin-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Сохранение…';
  try {
    await db.collection('settings').doc('results').set({
      series:             adminResults,
      currentRound:       adminCurrentRound,
      fullBracketLocked:  adminFullBracketLocked,
      updatedAt:          firebase.firestore.FieldValue.serverTimestamp()
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
}

function renderRoundControl() {
  const sel = document.getElementById('current-round-sel');
  if (!sel) return;
  sel.value = adminCurrentRound;
}

function renderLockControl() {
  const cb = document.getElementById('lock-full-bracket');
  if (!cb) return;
  cb.checked = adminFullBracketLocked;
}

function renderSeriesList() {
  const container = document.getElementById('admin-series-list');
  if (!container) return;

  // Group by round
  const byRound = [[], [], [], []];
  ADMIN_ALL_SERIES.forEach(s => byRound[s.round - 1].push(s));

  container.innerHTML = byRound.map((group, ri) => `
    <div style="margin-bottom:2rem">
      <h3 style="font-family:'Oswald',sans-serif;font-size:1rem;color:var(--text-2);
                 text-transform:uppercase;letter-spacing:.06em;
                 border-bottom:1px solid var(--border);padding-bottom:.5rem;margin-bottom:.75rem">
        ${ROUND_NAMES[ri]}
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
  container.querySelectorAll('.admin-games-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      const sid = sel.dataset.sid;
      if (!adminResults[sid]) adminResults[sid] = {};
      adminResults[sid].games = sel.value ? parseInt(sel.value) : null;
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

  const gamesOpts = [4,5,6,7].map(g =>
    `<option value="${g}"${result.games === g ? ' selected' : ''}>${g} игр</option>`
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
          <select class="admin-select admin-games-sel" data-sid="${sid}">
            <option value="">— Игр —</option>
            ${gamesOpts}
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

  document.getElementById('save-admin-btn')?.addEventListener('click', saveAdminData);
}
