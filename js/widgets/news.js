// ===== News Widget =====
(function() {
  const CONTAINER = 'news-content';
  const NAME = 'news';
  const PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const FEEDS = {
    nyt: { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', label: 'NYT' },
    mw:  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', label: 'MW' },
    bbc: { url: 'https://feeds.bbci.co.uk/news/rss.xml', label: 'BBC' }
  };

  let activeTab = 'nyt';
  let cachedData = { nyt: [], mw: [], bbc: [] };

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
    const tabs = Object.entries(FEEDS).map(([key, feed]) =>
      `<button class="widget-tab ${activeTab === key ? 'active' : ''}" data-tab="${key}">${feed.label}</button>`
    ).join('');
    return `<div class="widget-tabs">${tabs}</div>`;
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
      const keys = Object.keys(FEEDS);
      const results = await Promise.all(
        keys.map(k => fetchFeed(k).catch(() => cachedData[k]))
      );
      keys.forEach((k, i) => { cachedData[k] = results[i]; });
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
