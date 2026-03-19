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
    <div class="lb-row${meCls}${topCls}">
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
