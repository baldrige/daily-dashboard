// ===== Stocks Widget =====
(function() {
  const CONTAINER = 'stocks-content';
  const NAME = 'stocks';
  let timer = null;
  let selectedChart = null; // ticker symbol currently shown in chart

  function getTickers() {
    const raw = Dashboard.settings.tickers || 'SPY, AAPL, MSFT, GOOGL';
    return raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  }

  function isMarketHours() {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();
    const hour = et.getHours();
    const min = et.getMinutes();
    const timeVal = hour * 60 + min;
    return day >= 1 && day <= 5 && timeVal >= 570 && timeVal < 960;
  }

  async function fetchQuote(symbol, key) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`;
    const res = await fetch(url);
    if (res.status === 403) throw new Error('Invalid API key');
    if (res.status === 429) throw new Error('Rate limited — try again shortly');
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const hasData = data.c && data.c !== 0;
    return {
      symbol,
      price: hasData ? data.c : null,
      change: hasData ? data.d : null,
      changePercent: hasData ? data.dp : null,
      prevClose: hasData ? data.pc : null
    };
  }

  async function fetchCandleFinnhub(symbol, key) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 86400;
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.s !== 'ok' || !data.c || !data.c.length) return null;
    return { closes: data.c, timestamps: data.t };
  }

  async function fetchCandleYahoo(symbol) {
    const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;
    const res = await fetch(proxy);
    if (!res.ok) return null;
    const wrapper = await res.json();
    if (!wrapper.contents) return null;
    const data = JSON.parse(wrapper.contents);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp?.length) return null;
    const closes = result.indicators?.quote?.[0]?.close || [];
    // Filter out null entries (market holidays)
    const valid = result.timestamp.reduce((acc, t, i) => {
      if (closes[i] != null) acc.push({ t, c: closes[i] });
      return acc;
    }, []);
    if (valid.length < 2) return null;
    return { closes: valid.map(v => v.c), timestamps: valid.map(v => v.t) };
  }

  async function fetchCandle(symbol, key) {
    // Try Finnhub first, fall back to Yahoo Finance via proxy
    const fh = await fetchCandleFinnhub(symbol, key).catch(() => null);
    if (fh) return fh;
    return await fetchCandleYahoo(symbol).catch(() => null);
  }

  function renderChart(candle, symbol) {
    if (!candle || candle.closes.length < 2) {
      return '<div class="stock-chart-empty">No chart data available</div>';
    }

    const closes = candle.closes;
    const timestamps = candle.timestamps;
    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const range = maxP - minP || 1;
    const startPrice = closes[0];
    const endPrice = closes[closes.length - 1];
    const isUp = endPrice >= startPrice;
    const strokeColor = isUp ? 'var(--positive)' : 'var(--negative)';
    const fillOpacity = '0.12';

    const W = 320;
    const H = 80;
    const padX = 4;
    const padTop = 6;
    const padBot = 16;
    const chartH = H - padTop - padBot;
    const stepX = (W - padX * 2) / (closes.length - 1);

    const points = closes.map((c, i) => ({
      x: padX + i * stepX,
      y: padTop + chartH - ((c - minP) / range) * chartH
    }));

    const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
    const fillPath = linePath + ` L${points[points.length - 1].x},${H - padBot} L${points[0].x},${H - padBot} Z`;

    // Date labels: first, middle, last
    const dateFmt = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const midIdx = Math.floor(timestamps.length / 2);
    const dateLabels = [
      { x: points[0].x, label: dateFmt(timestamps[0]) },
      { x: points[midIdx].x, label: dateFmt(timestamps[midIdx]) },
      { x: points[points.length - 1].x, label: dateFmt(timestamps[timestamps.length - 1]) }
    ];

    const dateLabelsHtml = dateLabels.map(d =>
      `<text x="${d.x}" y="${H}" text-anchor="middle" fill="var(--text-muted)" font-size="7" font-family="var(--font-mono, monospace)">${d.label}</text>`
    ).join('');

    // Price labels: high and low
    const priceLabels = `
      <text x="${W - padX}" y="${padTop + 3}" text-anchor="end" fill="var(--text-muted)" font-size="7" font-family="var(--font-mono, monospace)">${maxP.toFixed(0)}</text>
      <text x="${W - padX}" y="${H - padBot - 2}" text-anchor="end" fill="var(--text-muted)" font-size="7" font-family="var(--font-mono, monospace)">${minP.toFixed(0)}</text>
    `;

    const changeAmt = endPrice - startPrice;
    const changePct = ((changeAmt / startPrice) * 100).toFixed(2);
    const sign = changeAmt >= 0 ? '+' : '';
    const changeColor = isUp ? 'var(--positive)' : 'var(--negative)';

    return `
      <div class="stock-chart">
        <div class="stock-chart-header">
          <span class="stock-chart-symbol">${symbol}</span>
          <span class="stock-chart-range">30 Day</span>
          <span class="stock-chart-change" style="color:${changeColor}">${sign}${changeAmt.toFixed(2)} (${sign}${changePct}%)</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="stockGrad-${symbol}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${strokeColor}" stop-opacity="${fillOpacity}" />
              <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.01" />
            </linearGradient>
          </defs>
          <path d="${fillPath}" fill="url(#stockGrad-${symbol})" />
          <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          ${dateLabelsHtml}
          ${priceLabels}
        </svg>
      </div>
    `;
  }

  function renderQuote(quote, isPrimary, isChartSelected) {
    const hasData = quote.price != null;
    const changeClass = hasData && quote.change >= 0 ? 'positive' : hasData ? 'negative' : '';
    const sign = hasData && quote.change >= 0 ? '+' : '';
    const priceStr = hasData ? quote.price.toFixed(2) : '--';
    const changeStr = hasData ? `${sign}${quote.change.toFixed(2)} (${sign}${quote.changePercent.toFixed(2)}%)` : 'No data';

    return `
      <div class="stock-row ${isPrimary ? 'stock-primary' : ''} ${isChartSelected ? 'stock-selected' : ''}" data-symbol="${quote.symbol}" role="button" tabindex="0">
        <span class="stock-symbol">${quote.symbol}</span>
        <span class="stock-price">${priceStr}</span>
        <span class="stock-change ${changeClass}">${changeStr}</span>
      </div>
    `;
  }

  async function refresh() {
    const key = Dashboard.settings.finnhubKey;
    if (!key) {
      Dashboard.showError(CONTAINER, 'Add your Finnhub API key in Settings');
      return;
    }

    try {
      const tickers = getTickers();
      // Default chart to first ticker
      if (!selectedChart || !tickers.includes(selectedChart)) {
        selectedChart = tickers[0];
      }

      let fetchError = null;
      // Fetch quotes first, then candle (avoid rate-limiting from too many concurrent requests)
      const quotes = await Promise.all(
        tickers.map(t => fetchQuote(t, key).catch(err => {
          fetchError = err;
          return { symbol: t, price: null, change: null, changePercent: null };
        }))
      );
      const candle = await fetchCandle(selectedChart, key).catch(err => {
        console.warn('Candle fetch error:', err);
        return null;
      });

      if (quotes.every(q => q.price == null)) {
        const msg = fetchError?.message || 'Could not load stock data';
        Dashboard.showError(CONTAINER, msg + '. Check your Finnhub API key in Settings.');
        return;
      }

      const marketOpen = isMarketHours();
      const statusText = marketOpen ? 'Market Open' : 'Market Closed';

      let html = `<div class="stock-market-status">${statusText}</div>`;

      // Chart at the top
      html += renderChart(candle, selectedChart);

      // Ticker rows
      quotes.forEach((q, i) => {
        html += renderQuote(q, i === 0, q.symbol === selectedChart);
      });

      const container = document.getElementById(CONTAINER);
      container.innerHTML = html;

      // Click handler: switch chart to clicked ticker
      container.querySelectorAll('.stock-row[data-symbol]').forEach(row => {
        row.addEventListener('click', () => {
          const sym = row.dataset.symbol;
          if (sym !== selectedChart) {
            selectedChart = sym;
            refresh();
          }
        });
      });

      Dashboard.setUpdatedTime(NAME);
      scheduleRefresh(marketOpen);
    } catch (err) {
      Dashboard.showError(CONTAINER, 'Could not load stock data. Check your API key.');
      console.error('Stocks widget error:', err);
    }
  }

  function scheduleRefresh(marketOpen) {
    if (timer) clearInterval(timer);
    const interval = marketOpen ? 5 * 60 * 1000 : 60 * 60 * 1000;
    timer = setInterval(refresh, interval);
  }

  function init() {
    refresh();
  }

  Dashboard.registerWidget(NAME, { init, refresh });
  init();
})();
