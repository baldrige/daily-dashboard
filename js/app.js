// ===== Dashboard Core =====
const Dashboard = {
  settings: {},
  timers: {},
  widgets: {},

  DEFAULTS: {
    owmKey: '',
    finnhubKey: '',
    calendarIds: [],
    tickers: 'SPY, AAPL, MSFT, GOOGL',
    theme: 'light'
  },

  init() {
    this.loadSettings();
    this.initClock();
    this.initTheme();
    this.initSettingsModal();
    this.initRefreshAll();
    this.initVisibilityRefresh();

    // Show settings on first visit if no API keys
    if (!this.settings.owmKey && !this.settings.finnhubKey) {
      this.showSettings();
    }

    // Initialize all widgets
    this.initWidgets();
  },

  // --- Settings ---
  loadSettings() {
    let calendarIds = [];
    try { calendarIds = JSON.parse(localStorage.getItem('dash_calendar_ids') || '[]'); } catch { }
    // Migrate old single-ID setting
    if (!calendarIds.length) {
      const old = localStorage.getItem('dash_calendar_id');
      if (old) { calendarIds = [old]; localStorage.setItem('dash_calendar_ids', JSON.stringify(calendarIds)); }
    }
    this.settings = {
      owmKey: localStorage.getItem('dash_owm_key') || this.DEFAULTS.owmKey,
      finnhubKey: localStorage.getItem('dash_finnhub_key') || this.DEFAULTS.finnhubKey,
      gcalKey: localStorage.getItem('dash_gcal_key') || '',
      calendarIds,
      tickers: localStorage.getItem('dash_tickers') || this.DEFAULTS.tickers,
      theme: localStorage.getItem('dash_theme') || this.DEFAULTS.theme,
    };
  },

  // --- Calendar ID management in settings ---
  _pendingCalendarIds: [],

  renderCalendarIdList() {
    const container = document.getElementById('calendar-ids-list');
    if (!this._pendingCalendarIds.length) {
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:4px 0">No calendars added yet.</div>';
      return;
    }
    container.innerHTML = this._pendingCalendarIds.map((id, i) => `
      <div class="calendar-id-item">
        <span>${id}</span>
        <button class="remove-cal-btn" data-index="${i}" title="Remove">&times;</button>
      </div>
    `).join('');
    container.querySelectorAll('.remove-cal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._pendingCalendarIds.splice(parseInt(btn.dataset.index), 1);
        this.renderCalendarIdList();
      });
    });
  },

  addCalendarId() {
    const input = document.getElementById('setting-calendar-id-new');
    const val = input.value.trim();
    if (val && !this._pendingCalendarIds.includes(val)) {
      this._pendingCalendarIds.push(val);
      this.renderCalendarIdList();
      input.value = '';
    }
  },

  saveSettings() {
    const fields = {
      owmKey: document.getElementById('setting-owm-key').value.trim(),
      finnhubKey: document.getElementById('setting-finnhub-key').value.trim(),
      gcalKey: document.getElementById('setting-gcal-key').value.trim(),
      calendarIds: [...this._pendingCalendarIds],
      tickers: document.getElementById('setting-tickers').value.trim() || this.DEFAULTS.tickers,
    };
    localStorage.setItem('dash_owm_key', fields.owmKey);
    localStorage.setItem('dash_finnhub_key', fields.finnhubKey);
    localStorage.setItem('dash_gcal_key', fields.gcalKey);
    localStorage.setItem('dash_calendar_ids', JSON.stringify(fields.calendarIds));
    localStorage.setItem('dash_tickers', fields.tickers);
    Object.assign(this.settings, fields);
    this.hideSettings();
    this.refreshAll();
  },

  showSettings() {
    document.getElementById('setting-owm-key').value = this.settings.owmKey;
    document.getElementById('setting-gcal-key').value = this.settings.gcalKey;
    document.getElementById('setting-finnhub-key').value = this.settings.finnhubKey;
    document.getElementById('setting-tickers').value = this.settings.tickers;
    this._pendingCalendarIds = [...this.settings.calendarIds];
    this.renderCalendarIdList();
    document.getElementById('settings-modal').classList.remove('hidden');
  },

  hideSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  },

  initSettingsModal() {
    document.getElementById('settings-btn').addEventListener('click', () => this.showSettings());
    document.getElementById('settings-close-btn').addEventListener('click', () => this.hideSettings());
    document.getElementById('settings-save-btn').addEventListener('click', () => this.saveSettings());
    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideSettings();
    });
    document.getElementById('add-calendar-btn').addEventListener('click', () => this.addCalendarId());
    document.getElementById('setting-calendar-id-new').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.addCalendarId(); }
    });
  },

  // --- Theme ---
  initTheme() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    this.updateThemeIcon();
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      const next = this.settings.theme === 'dark' ? 'light' : 'dark';
      this.settings.theme = next;
      localStorage.setItem('dash_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      this.updateThemeIcon();
    });
  },

  updateThemeIcon() {
    document.getElementById('theme-toggle-btn').innerHTML =
      this.settings.theme === 'dark' ? '&#x2600;' : '&#x263E;';
  },

  // --- Clock ---
  initClock() {
    const el = document.getElementById('header-clock');
    const update = () => {
      const now = new Date();
      const date = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      el.innerHTML = `${date}<br>${time}`;
    };
    update();
    setInterval(update, 1000);
  },

  // --- Refresh ---
  initRefreshAll() {
    document.getElementById('refresh-all-btn').addEventListener('click', () => this.refreshAll());
  },

  initVisibilityRefresh() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refreshAll();
    });
  },

  refreshAll() {
    Object.values(this.widgets).forEach(w => {
      if (w && typeof w.refresh === 'function') w.refresh();
    });
  },

  // --- Widget Registration ---
  registerWidget(name, widget) {
    this.widgets[name] = widget;
  },

  initWidgets() {
    // Widgets register themselves when their scripts load, but don't self-start.
    // We init them here after settings are loaded.
    Object.values(this.widgets).forEach(w => {
      if (w && typeof w.init === 'function') w.init();
    });
  },

  // --- Helpers ---
  setUpdatedTime(widgetName) {
    const el = document.querySelector(`.last-updated[data-widget="${widgetName}"]`);
    if (el) {
      el.textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
      });
    }
  },

  timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return diff + 'm ago';
    if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
    return Math.floor(diff / 1440) + 'd ago';
  },

  showError(elementId, message) {
    document.getElementById(elementId).innerHTML =
      `<div class="widget-error">${message}</div>`;
  }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => Dashboard.init());
