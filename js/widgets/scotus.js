// ===== Supreme Court Widget =====
(function() {
  const CONTAINER = 'scotus-content';
  const NAME = 'scotus';
  const CACHE_KEY = 'dash_scotus_cache';
  const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

  let cachedOpinions = [];
  let cachedArgs = [];

  // SCOTUS term number: Oct 2024-Oct 2025 = term "24", etc.
  function getCurrentTermNum() {
    const now = new Date();
    const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return String(year).slice(-2);
  }

  // --- localStorage cache ---
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.timestamp > CACHE_TTL * 4) return false; // stale after 24h
      cachedOpinions = cached.opinions || [];
      cachedArgs = cached.args || [];
      return cachedOpinions.length > 0;
    } catch { return false; }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        opinions: cachedOpinions,
        args: cachedArgs,
        timestamp: Date.now()
      }));
    } catch { /* quota exceeded, ignore */ }
  }

  function cacheIsFresh() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw);
      return Date.now() - cached.timestamp < CACHE_TTL;
    } catch { return false; }
  }

  // --- Fetch via CORS proxy (single attempt, no retry) ---
  async function fetchViaProxy(targetUrl) {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
    const data = await res.json();
    if (!data.contents) throw new Error('Empty response from proxy');
    return data.contents;
  }

  function parseOpinions(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('table.table-bordered tr');
    const opinions = [];

    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 6) continue;

      const date = cells[1]?.textContent?.trim();
      const docket = cells[2]?.textContent?.trim();
      const nameLink = cells[3]?.querySelector('a');
      const caseName = nameLink?.textContent?.trim();
      const pdfPath = nameLink?.getAttribute('href');
      const justice = cells[4]?.textContent?.trim();

      if (!caseName || !date) continue;

      const pdfUrl = pdfPath ? `https://www.supremecourt.gov${pdfPath}` : '';
      opinions.push({ date, docket, caseName, pdfUrl, justice });
    }

    return opinions;
  }

  function parseArguments(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const args = [];

    const panels = doc.querySelectorAll('.card-body, .panel-body, td');
    let currentDate = '';

    for (const el of panels) {
      const text = el.textContent?.trim();
      const dateMatch = text?.match(/^\w+,\s+\w+\s+\d{1,2},\s+\d{4}/);
      if (dateMatch) {
        currentDate = dateMatch[0];
      }
      const links = el.querySelectorAll('a[href*="docket"]');
      for (const link of links) {
        const caseName = link.textContent?.trim();
        if (caseName && caseName.length > 3) {
          args.push({ caseName, date: currentDate });
        }
      }
    }

    return args.slice(0, 8);
  }

  function renderOpinions(opinions) {
    if (!opinions.length) return '<div class="widget-error">No opinions found for this term</div>';

    const recent = opinions.slice(0, 8);
    const itemsHtml = recent.map(op => {
      const link = op.pdfUrl
        ? `<a href="${op.pdfUrl}" target="_blank" rel="noopener">${op.caseName}</a>`
        : `<span>${op.caseName}</span>`;
      const justiceLabel = op.justice ? ` &bull; ${op.justice}` : '';
      return `
        <div class="scotus-item">
          ${link}
          <div class="scotus-date">${op.date}${justiceLabel}${op.docket ? ' &bull; No. ' + op.docket : ''}</div>
        </div>
      `;
    }).join('');

    return `<div class="scotus-section-title">Recent Opinions</div>${itemsHtml}`;
  }

  function renderArguments(args) {
    if (!args.length) return '';

    const itemsHtml = args.map(a => `
      <div class="scotus-item">
        <span style="font-family:var(--font-display,sans-serif);font-size:0.95rem;font-weight:600">${a.caseName}</span>
        <div class="scotus-date">${a.date}</div>
      </div>
    `).join('');

    return `<div class="scotus-section-title">Upcoming Arguments</div>${itemsHtml}`;
  }

  function render() {
    let content = renderOpinions(cachedOpinions);
    if (cachedArgs.length) content += renderArguments(cachedArgs);
    if (!content || content.includes('widget-error')) {
      content = content || '<div class="widget-error">No Supreme Court data available</div>';
    }
    document.getElementById(CONTAINER).innerHTML = content;
  }

  async function fetchFresh() {
    const termNum = getCurrentTermNum();
    const html = await fetchViaProxy(`https://www.supremecourt.gov/opinions/slipopinion/${termNum}`);
    const opinions = parseOpinions(html);
    if (opinions.length) cachedOpinions = opinions;

    try {
      const argsHtml = await fetchViaProxy('https://www.supremecourt.gov/oral_arguments/argument_calendar.aspx');
      const args = parseArguments(argsHtml);
      if (args.length) cachedArgs = args;
    } catch { /* arguments calendar is optional */ }

    saveToStorage();
    render();
    Dashboard.setUpdatedTime(NAME);
  }

  function init() {
    // Show cached data instantly if available
    if (loadFromStorage()) {
      render();
      Dashboard.setUpdatedTime(NAME);

      // If cache is still fresh, skip the network fetch
      if (cacheIsFresh()) {
        setInterval(refresh, CACHE_TTL);
        return;
      }
    }

    // Fetch fresh data (in background if we already rendered from cache)
    fetchFresh().catch(err => {
      if (!cachedOpinions.length) {
        Dashboard.showError(CONTAINER, 'Could not load Supreme Court data');
      }
      console.error('SCOTUS widget error:', err);
    });

    setInterval(refresh, CACHE_TTL);
  }

  async function refresh() {
    try {
      await fetchFresh();
    } catch (err) {
      if (cachedOpinions.length) {
        render();
      } else {
        Dashboard.showError(CONTAINER, 'Could not load Supreme Court data');
      }
      console.error('SCOTUS widget error:', err);
    }
  }

  Dashboard.registerWidget(NAME, { init, refresh });
})();
