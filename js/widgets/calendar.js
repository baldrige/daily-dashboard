// ===== Calendar Widget =====
(function() {
  const CONTAINER = 'calendar-content';
  const NAME = 'calendar';

  async function fetchEvents(calendarId, apiKey) {
    const now = new Date().toISOString();
    const maxDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      + `?key=${apiKey}&timeMin=${now}&timeMax=${maxDate}&maxResults=15&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
    const data = await res.json();
    return (data.items || []).map(ev => ({
      title: ev.summary || '(No title)',
      start: ev.start?.dateTime || ev.start?.date || '',
      end: ev.end?.dateTime || ev.end?.date || '',
      allDay: !ev.start?.dateTime,
      calendarId
    }));
  }

  function isToday(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }

  function isTomorrow(dateStr) {
    const d = new Date(dateStr);
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return d.toDateString() === tom.toDateString();
  }

  function dayLabel(dateStr) {
    if (isToday(dateStr)) return 'Today';
    if (isTomorrow(dateStr)) return 'Tomorrow';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function renderEvents(events) {
    if (!events.length) {
      return '<div class="cal-empty">No upcoming events this week</div>';
    }

    // Group by day
    const groups = {};
    for (const ev of events) {
      const key = new Date(ev.start).toDateString();
      if (!groups[key]) groups[key] = { label: dayLabel(ev.start), events: [] };
      groups[key].events.push(ev);
    }

    return Object.values(groups).map(group => {
      const isGroupToday = group.label === 'Today';
      const eventsHtml = group.events.map(ev => {
        const timeStr = ev.allDay ? 'All day' : `${formatTime(ev.start)} – ${formatTime(ev.end)}`;
        return `
          <div class="cal-event">
            <div class="cal-event-time">${timeStr}</div>
            <div class="cal-event-title">${ev.title}</div>
          </div>
        `;
      }).join('');
      return `
        <div class="cal-day-group ${isGroupToday ? 'cal-today' : ''}">
          <div class="cal-day-label">${group.label}</div>
          ${eventsHtml}
        </div>
      `;
    }).join('');
  }

  function renderIframeFallback(calIds) {
    const theme = Dashboard.settings.theme === 'dark' ? 'dark' : 'light';
    const srcParams = calIds.map(id => `src=${encodeURIComponent(id)}`).join('&');
    const src = `https://calendar.google.com/calendar/embed?${srcParams}&ctz=America/New_York&mode=AGENDA&showTitle=0&showNav=0&showPrint=0&showTabs=0&showCalendars=0&bgcolor=${theme === 'dark' ? '%23111' : '%23fff'}`;
    return `<iframe src="${src}" title="Google Calendar" loading="lazy"></iframe>`;
  }

  async function refresh() {
    const calIds = Dashboard.settings.calendarIds || [];
    const apiKey = Dashboard.settings.gcalKey;

    if (!calIds.length) {
      document.getElementById(CONTAINER).innerHTML = `
        <div class="cal-empty">
          No calendars configured.
          <a href="#" id="calendar-open-settings">Open Settings to add calendars</a>
        </div>
      `;
      document.getElementById('calendar-open-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        Dashboard.showSettings();
      });
      return;
    }

    // If we have an API key, use the styled approach
    if (apiKey) {
      try {
        const allEvents = await Promise.all(
          calIds.map(id => fetchEvents(id, apiKey).catch(() => []))
        );
        const merged = allEvents.flat().sort((a, b) => new Date(a.start) - new Date(b.start));
        document.getElementById(CONTAINER).innerHTML = renderEvents(merged);
        Dashboard.setUpdatedTime(NAME);
        return;
      } catch (err) {
        console.error('Calendar API error:', err);
        // Fall through to iframe
      }
    }

    // Fallback: iframe embed
    document.getElementById(CONTAINER).innerHTML = renderIframeFallback(calIds);
    Dashboard.setUpdatedTime(NAME);
  }

  function init() {
    refresh();
    setInterval(refresh, 15 * 60 * 1000);
  }

  Dashboard.registerWidget(NAME, { init, refresh });
})();
