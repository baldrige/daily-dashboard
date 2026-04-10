// ===== Phillies Widget =====
(function() {
  const TEAM_ID = 143;
  const CONTAINER = 'phillies-content';
  const NAME = 'phillies';
  let liveTimer = null;
  let normalTimer = null;

  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }

  function formatGameTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function formatShortDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  }

  function boxScoreUrl(gamePk) {
    return `https://www.mlb.com/gameday/${gamePk}`;
  }

  async function fetchSchedule() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const end = new Date(today);
    end.setDate(end.getDate() + 14);

    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${formatDate(start)}&endDate=${formatDate(end)}&hydrate=team,linescore,decisions,probablePitcher`;
    const res = await fetch(url);
    const data = await res.json();
    return data.dates || [];
  }

  async function fetchLiveGame(gamePk) {
    const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
    const res = await fetch(url);
    return await res.json();
  }

  function getPhilliesTeamSide(game) {
    return game.teams.home.team.id === TEAM_ID ? 'home' : 'away';
  }

  // Render a baseball-style linescore table
  function renderLinescore(game, liveData) {
    const ls = liveData?.liveData?.linescore || game.linescore;
    if (!ls || !ls.innings || !ls.innings.length) return '';

    const innings = ls.innings;
    const totals = ls.teams || {};
    const away = game.teams.away;
    const home = game.teams.home;

    // Build header: 1 2 3 4 5 6 7 8 9 (+ extras) | R H E
    const inningNums = innings.map(i => i.num);
    const headerCells = inningNums.map(n => `<th>${n}</th>`).join('');

    const awayInnings = innings.map(i => {
      const runs = i.away?.runs;
      return `<td>${runs != null ? runs : ''}</td>`;
    }).join('');

    const homeInnings = innings.map(i => {
      const runs = i.home?.runs;
      return `<td>${runs != null ? runs : ''}</td>`;
    }).join('');

    const at = totals.away || {};
    const ht = totals.home || {};

    // Pitching decisions
    const dec = game.decisions || {};
    const parts = [];
    if (dec.winner) parts.push(`<span class="dec-w">W:</span> ${dec.winner.fullName}`);
    if (dec.loser) parts.push(`<span class="dec-l">L:</span> ${dec.loser.fullName}`);
    if (dec.save) parts.push(`<span class="dec-s">SV:</span> ${dec.save.fullName}`);
    const decisionsHtml = parts.length
      ? `<div class="linescore-decisions">${parts.join('<span class="dec-sep">&bull;</span>')}</div>`
      : '';

    return `
      <div class="linescore-wrapper">
        <table class="linescore">
          <thead>
            <tr>
              <th class="ls-team"></th>
              ${headerCells}
              <th class="ls-total">R</th>
              <th class="ls-total">H</th>
              <th class="ls-total">E</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="ls-team">${away.team.abbreviation}</td>
              ${awayInnings}
              <td class="ls-total">${at.runs ?? ''}</td>
              <td class="ls-total">${at.hits ?? ''}</td>
              <td class="ls-total">${at.errors ?? ''}</td>
            </tr>
            <tr>
              <td class="ls-team">${home.team.abbreviation}</td>
              ${homeInnings}
              <td class="ls-total">${ht.runs ?? ''}</td>
              <td class="ls-total">${ht.hits ?? ''}</td>
              <td class="ls-total">${ht.errors ?? ''}</td>
            </tr>
          </tbody>
        </table>
        ${decisionsHtml}
      </div>
    `;
  }

  function renderLiveGame(game, liveData) {
    const ls = liveData?.liveData?.linescore;
    const inningHalf = ls?.inningHalf === 'Top' ? 'Top' : 'Bot';
    const inning = ls ? `${inningHalf} ${ls.currentInning}` : '';
    const outs = ls ? `${ls.outs} out` : '';

    return `
      <div class="phillies-live">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="live-badge">Live</span>
          <span style="font-size:0.75rem;color:var(--text-secondary)">${inning} &bull; ${outs}</span>
          <a href="${boxScoreUrl(game.gamePk)}" target="_blank" rel="noopener" style="font-size:0.7rem;margin-left:auto">Gameday</a>
        </div>
        ${renderLinescore(game, liveData)}
      </div>
    `;
  }

  function renderFeaturedGame(game) {
    // The most recent completed game gets a full linescore
    const side = getPhilliesTeamSide(game);
    const us = game.teams[side];
    const won = us.isWinner;

    return `
      <div class="phillies-featured">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span style="font-size:0.72rem;font-weight:600;color:${won ? 'var(--positive)' : 'var(--negative)'}">${won ? 'W' : 'L'}</span>
          <span style="font-size:0.72rem;color:var(--text-secondary)">${formatShortDate(game.gameDate)}</span>
          <a href="${boxScoreUrl(game.gamePk)}" target="_blank" rel="noopener" style="font-size:0.68rem;margin-left:auto">Box Score</a>
        </div>
        ${renderLinescore(game, null)}
      </div>
    `;
  }

  function renderRecentGames(games) {
    if (!games.length) return '';
    return games.map(game => {
      const side = getPhilliesTeamSide(game);
      const opp = side === 'home' ? game.teams.away : game.teams.home;
      const us = game.teams[side];
      const won = us.isWinner;
      const prefix = side === 'home' ? 'vs' : '@';
      return `
        <a class="game-score" href="${boxScoreUrl(game.gamePk)}" target="_blank" rel="noopener">
          <span class="game-date">${formatShortDate(game.gameDate)}</span>
          <span class="team">${prefix} ${opp.team.teamName}</span>
          <span class="score ${won ? 'result-w' : 'result-l'}">${won ? 'W' : 'L'}</span>
          <span class="score">${us.score}-${opp.score}</span>
        </a>
      `;
    }).join('');
  }

  function renderNextGame(game) {
    if (!game) return '';
    const side = getPhilliesTeamSide(game);
    const opp = side === 'home' ? game.teams.away : game.teams.home;
    const us = game.teams[side];
    const prefix = side === 'home' ? 'vs' : '@';

    const ppUs = us.probablePitcher?.fullName || 'TBD';
    const ppOpp = opp.probablePitcher?.fullName || 'TBD';
    const pitcherLine = side === 'home'
      ? `${ppOpp} vs ${ppUs}`
      : `${ppUs} vs ${ppOpp}`;

    return `
      <div class="phillies-next">
        Next: <a href="${boxScoreUrl(game.gamePk)}" target="_blank" rel="noopener"><strong>${prefix} ${opp.team.teamName}</strong> &mdash; ${formatShortDate(game.gameDate)} at ${formatGameTime(game.gameDate)}</a>
        <div class="probable-pitchers">${pitcherLine}</div>
      </div>
    `;
  }

  function getRecord(games) {
    for (let i = games.length - 1; i >= 0; i--) {
      const game = games[i];
      const side = getPhilliesTeamSide(game);
      const rec = game.teams[side].leagueRecord;
      if (rec) return `${rec.wins}-${rec.losses}`;
    }
    return null;
  }

  async function refresh() {
    try {
      const dates = await fetchSchedule();
      const allGames = dates.flatMap(d => d.games || []);

      const completed = allGames.filter(g => g.status.abstractGameState === 'Final');
      const live = allGames.filter(g => g.status.abstractGameState === 'Live');
      const future = allGames.filter(g => g.status.abstractGameState === 'Preview');

      let html = '';

      // Record
      const record = getRecord(completed);
      if (record) {
        html += `<div class="phillies-record">Season Record: <strong>${record}</strong></div>`;
      }

      // Live game (with full linescore)
      if (live.length > 0) {
        const liveGame = live[0];
        try {
          const liveData = await fetchLiveGame(liveGame.gamePk);
          html += renderLiveGame(liveGame, liveData);
        } catch {
          html += renderLiveGame(liveGame, null);
        }
        startLivePolling();
      } else {
        stopLivePolling();

        // Show most recent completed game with full linescore
        if (completed.length > 0) {
          const featured = completed[completed.length - 1];
          html += renderFeaturedGame(featured);
        }
      }

      // Recent games (previous 4, excluding the featured one)
      const recentSlice = live.length > 0 ? completed.slice(-4) : completed.slice(-5, -1);
      if (recentSlice.length) {
        html += '<div style="font-size:0.68rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.08em;margin:6px 0 4px;font-family:var(--font-mono,monospace)">Recent</div>';
        html += renderRecentGames(recentSlice);
      }

      // Next game
      if (future.length > 0) {
        html += renderNextGame(future[0]);
      }

      if (!html) {
        html = '<div class="widget-error">No games scheduled</div>';
      }

      document.getElementById(CONTAINER).innerHTML = html;
      Dashboard.setUpdatedTime(NAME);
    } catch (err) {
      Dashboard.showError(CONTAINER, 'Could not load Phillies data');
      console.error('Phillies widget error:', err);
    }
  }

  function startLivePolling() {
    if (liveTimer) return;
    liveTimer = setInterval(refresh, 30000);
  }

  function stopLivePolling() {
    if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
  }

  function init() {
    refresh();
    normalTimer = setInterval(refresh, 15 * 60 * 1000);
  }

  Dashboard.registerWidget(NAME, { init, refresh });
})();
