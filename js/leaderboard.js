// ============================================================
// LEADERBOARD — fetch all predictions, calculate scores, render
// ============================================================

async function loadLeaderboard(mode = 'full') {
  const container = document.getElementById('leaderboard-body');
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> Загрузка…</div>`;

  try {
    // Load results
    const settingsSnap = await db.collection('settings').doc('results').get();
    const resultsData  = settingsSnap.exists ? (settingsSnap.data().series || {}) : {};
    const currentRound = settingsSnap.exists ? (settingsSnap.data().currentRound || 1) : 1;

    // Load all predictions
    const predsSnap = await db.collection('predictions').get();
    if (predsSnap.empty) {
      container.innerHTML = '<div class="lb-empty">Прогнозов ещё нет. Будь первым! 🏒</div>';
      return;
    }

    // Calculate scores
    const rows = [];
    predsSnap.forEach(doc => {
      const data = doc.data();
      let predMap = {};
      if (mode === 'full' && data.fullBracket) {
        predMap = data.fullBracket;
      } else if (mode === 'round' && data.roundPredictions) {
        // merge all round picks into one flat map
        for (const rPicks of Object.values(data.roundPredictions)) {
          Object.assign(predMap, rPicks);
        }
      } else if (data.fullBracket) {
        predMap = data.fullBracket;
      }

      const { total, breakdown } = calculateScore(predMap, resultsData);
      rows.push({
        uid:      doc.id,
        username: data.username || 'Аноним',
        total,
        breakdown
      });
    });

    // Sort descending
    rows.sort((a, b) => b.total - a.total);

    // Render
    container.innerHTML = rows.length === 0
      ? '<div class="lb-empty">Нет данных для отображения.</div>'
      : rows.map((row, i) => buildLbRow(row, i)).join('');

  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">Ошибка загрузки: ${e.message}</div>`;
  }
}

function buildLbRow(row, index) {
  const rank = index + 1;
  let rankCls = '';
  let rankStr = rank;
  if (rank === 1) { rankCls = 'gold';   rankStr = '🥇'; }
  if (rank === 2) { rankCls = 'silver'; rankStr = '🥈'; }
  if (rank === 3) { rankCls = 'bronze'; rankStr = '🥉'; }

  const bd = row.breakdown?.byRound || [0,0,0,0];
  const meCls = (window._myUid && window._myUid === row.uid) ? ' me' : '';
  const topCls = rank === 1 ? ' top-1' : '';

  return `
    <div class="lb-row${meCls}${topCls}" style="cursor:pointer" onclick="viewUserPicks('${row.uid}','${escapeHtml(row.username)}')">
      <div class="lb-rank ${rankCls}">${rankStr}</div>
      <div class="lb-name">${escapeHtml(row.username)}${meCls ? ' <span style="color:var(--text-3);font-size:.75rem">(вы)</span>' : ''}</div>
      <div class="lb-total">${row.total} <span style="font-size:.75rem;color:var(--text-2)">очков</span></div>
      <div class="lb-round">${bd[0]}</div>
      <div class="lb-round">${bd[1]}</div>
      <div class="lb-round">${bd[2]}</div>
      <div class="lb-round">${bd[3]}</div>
    </div>
  `;
}

// ── View another user's picks ─────────────────────────────
async function viewUserPicks(uid, username) {
  const modal = document.getElementById('picks-modal');
  const body  = document.getElementById('picks-modal-body');
  const title = document.getElementById('picks-modal-title');
  if (!modal) return;

  title.textContent = `Прогноз: ${username}`;
  body.innerHTML = '<div class="loading-overlay" style="position:static;padding:2rem"><div class="spinner"></div></div>';
  modal.classList.remove('hidden');

  try {
    const [predSnap, settingsSnap] = await Promise.all([
      db.collection('predictions').doc(uid).get(),
      db.collection('settings').doc('results').get()
    ]);

    const pred    = predSnap.exists ? predSnap.data() : {};
    const results = settingsSnap.exists ? (settingsSnap.data().series || {}) : {};
    const fullPicks  = pred.fullBracket || null;
    const roundPicks = pred.roundPredictions || null;

    let html = '';

    if (fullPicks) {
      html += `<div class="picks-mode-label">Полная сетка</div>${buildPicksView(fullPicks, results)}`;
    }
    if (roundPicks) {
      html += `<div class="picks-mode-label" style="margin-top:2rem">По раундам</div>${buildPicksView(
        Object.values(roundPicks).reduce((acc, rnd) => Object.assign(acc, rnd), {}),
        results
      )}`;
    }
    if (!fullPicks && !roundPicks) {
      html = '<div class="lb-empty">Пользователь ещё не заполнил прогноз.</div>';
    }

    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div class="alert alert-danger">Ошибка загрузки: ${e.message}</div>`;
  }
}

function closePicksModal() {
  document.getElementById('picks-modal')?.classList.add('hidden');
}

// ── Render picks as a round-by-round list ─────────────────
function buildPicksView(userPicks, results) {
  const ROUNDS = [
    { name: '1/8 финала', ids: ['w1','w2','w3','w4','e1','e2','e3','e4'] },
    { name: '1/4 финала', ids: ['w1w2','w3w4','e1e2','e3e4'] },
    { name: '1/2 финала', ids: ['wf','ef'] },
    { name: 'Финал КГ',   ids: ['final'] }
  ];
  const TREE = {
    'w1w2':['w1','w2'],'w3w4':['w3','w4'],
    'e1e2':['e1','e2'],'e3e4':['e3','e4'],
    'wf':['w1w2','w3w4'],'ef':['e1e2','e3e4'],
    'final':['wf','ef']
  };
  const REV_SCORE = {'4:0':'0:4','4:1':'1:4','4:2':'2:4','4:3':'3:4'};

  function getTeams(sid) {
    const r1W = BRACKET.west.r1.find(s => s.id === sid);
    if (r1W) return [r1W.home, r1W.away];
    const r1E = BRACKET.east.r1.find(s => s.id === sid);
    if (r1E) return [r1E.home, r1E.away];
    const ch = TREE[sid];
    if (!ch) return ['?','?'];
    const gw = (csid) => results[csid]?.winner || userPicks[csid]?.winner || '?';
    return [gw(ch[0]), gw(ch[1])];
  }

  let html = '';
  for (const { name, ids } of ROUNDS) {
    const cards = ids.map(sid => {
      const [t1, t2] = getTeams(sid);
      const pick   = userPicks[sid] || {};
      const result = results[sid];
      const complete = result?.complete;

      if (!pick.winner && !complete) {
        return `<div class="series-card locked" style="opacity:.5">
          <div class="series-team disabled"><span class="team-name" style="color:var(--text-3)">${t1 || 'TBD'}</span></div>
          <div class="series-team disabled"><span class="team-name" style="color:var(--text-3)">${t2 || 'TBD'}</span></div>
        </div>`;
      }

      const teamHtml = (team) => {
        const isPicked = pick.winner === team;
        const isWinner = complete && result.winner === team;
        const cls = `series-team disabled${isPicked?' selected':''}${isWinner?' winner':''}`;
        return `<div class="${cls}"><div class="team-pick-indicator"></div><span class="team-name">${team}</span></div>`;
      };

      const useReversed = pick.winner && pick.winner === t2;
      const scoreDisplay = pick.score
        ? (useReversed ? (REV_SCORE[pick.score] || pick.score) : pick.score)
        : '—';

      let statusIcon = '';
      if (complete && pick.winner) {
        if (pick.winner === result.winner && pick.score === result.score) statusIcon = ' ✅';
        else if (pick.winner === result.winner) statusIcon = ' ☑️';
        else statusIcon = ' ❌';
      }

      return `<div class="series-card${complete?' complete':''}">
        ${teamHtml(t1 || 'TBD')}
        ${teamHtml(t2 || 'TBD')}
        <div class="series-games-row" style="justify-content:center">
          <span style="font-size:.8rem;color:var(--text-2)">Счёт:</span>
          <span style="font-weight:600;margin-left:.35rem">${scoreDisplay}${statusIcon}</span>
        </div>
      </div>`;
    }).join('');

    html += `<div class="picks-round">
      <div class="picks-round-name">${name}</div>
      <div class="series-grid">${cards}</div>
    </div>`;
  }
  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Real-time refresh ─────────────────────────────────────
function subscribeLeaderboard(mode) {
  const container = document.getElementById('leaderboard-body');
  // Simple polling every 60s (Firestore real-time for all docs can be expensive on free tier)
  loadLeaderboard(mode);
  setInterval(() => loadLeaderboard(mode), 60_000);
}
