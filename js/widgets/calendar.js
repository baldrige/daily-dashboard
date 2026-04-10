// ===== Calendar Widget =====
(function() {
  const CONTAINER = 'calendar-content';
  const NAME = 'calendar';

  function render() {
    const calIds = Dashboard.settings.calendarIds || [];
    if (!calIds.length) {
      document.getElementById(CONTAINER).innerHTML = `
        <div class="calendar-setup-msg">
          No calendars configured.
          <a href="#" id="calendar-open-settings">Open Settings to add your Google Calendar IDs</a>
        </div>
      `;
      document.getElementById('calendar-open-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        Dashboard.showSettings();
      });
      return;
    }

    const theme = Dashboard.settings.theme === 'dark' ? 'dark' : 'light';
    // Build embed URL with multiple src params for each calendar
    const srcParams = calIds.map(id => `src=${encodeURIComponent(id)}`).join('&');
    const src = `https://calendar.google.com/calendar/embed?${srcParams}&ctz=America/New_York&mode=AGENDA&showTitle=0&showNav=0&showPrint=0&showTabs=0&showCalendars=0&bgcolor=${theme === 'dark' ? '%23111' : '%23fff'}`;

    document.getElementById(CONTAINER).innerHTML = `
      <iframe src="${src}" title="Google Calendar" loading="lazy"></iframe>
    `;
    Dashboard.setUpdatedTime(NAME);
  }

  function refresh() {
    render();
  }

  function init() {
    render();
  }

  Dashboard.registerWidget(NAME, { init, refresh });
  init();
})();
