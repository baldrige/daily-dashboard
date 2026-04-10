// ===== News Widget =====
(function() {
  const CONTAINER = 'news-content';
  const NAME = 'news';
  const PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const FEEDS = {
    nyt: { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', label: 'NYT' },
    wsj: { url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', label: 'WSJ' }
  };

  let activeTab = 'nyt';
  let cachedData = { nyt: [], wsj: [] };

  async function fetchFeed(key) {
    const feed = FEEDS[key];
    const url = PROXY + encodeURIComponent(feed.url);
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('Feed error');
    return (data.items || []).slice(0, 8).map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: feed.label
    }));
  }

  function renderTabs() {
    return `
      <div class="widget-tabs">
        <button class="widget-tab ${activeTab === 'nyt' ? 'active' : ''}" data-tab="nyt">NYT</button>
        <button class="widget-tab ${activeTab === 'wsj' ? 'active' : ''}" data-tab="wsj">WSJ</button>
      </div>
    `;
  }

  function renderItems(items) {
    if (!items.length) return '<div class="widget-error">No stories available</div>';
    return items.map(item => `
      <div class="news-item">
        <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
        <div class="news-meta">
          <span class="news-source">${item.source}</span>
          <span>${Dashboard.timeAgo(item.pubDate)}</span>
        </div>
      </div>
    `).join('');
  }

  function render() {
    const container = document.getElementById(CONTAINER);
    container.innerHTML = renderTabs() + renderItems(cachedData[activeTab]);

    container.querySelectorAll('.widget-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        render();
      });
    });
  }

  async function refresh() {
    try {
      const [nyt, wsj] = await Promise.all([
        fetchFeed('nyt').catch(() => cachedData.nyt),
        fetchFeed('wsj').catch(() => cachedData.wsj)
      ]);
      cachedData.nyt = nyt;
      cachedData.wsj = wsj;
      render();
      Dashboard.setUpdatedTime(NAME);
    } catch (err) {
      Dashboard.showError(CONTAINER, 'Could not load news');
      console.error('News widget error:', err);
    }
  }

  function init() {
    refresh();
    setInterval(refresh, 30 * 60 * 1000);
  }

  Dashboard.registerWidget(NAME, { init, refresh });
})();
