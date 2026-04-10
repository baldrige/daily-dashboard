// ===== Weather Widget =====
(function() {
  const CONTAINER = 'weather-content';
  const NAME = 'weather';
  const LOCATIONS = [
    { name: 'Potomac, MD', query: 'Potomac,MD,US' },
    { name: 'Dallas, TX', query: 'Dallas,TX,US' }
  ];

  async function fetchCurrent(query, key) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${key}&units=imperial`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    return await res.json();
  }

  async function fetchForecast(query, key) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${query}&appid=${key}&units=imperial`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Forecast API error: ${res.status}`);
    return await res.json();
  }

  function getTodayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function getTodayHighLow(forecastData, currentTemp) {
    const today = getTodayStr();
    let hi = currentTemp;
    let lo = currentTemp;
    for (const item of forecastData.list) {
      const date = item.dt_txt.split(' ')[0];
      if (date === today) {
        hi = Math.max(hi, item.main.temp_max);
        lo = Math.min(lo, item.main.temp_min);
      }
    }
    return { hi, lo };
  }

  function getDailyForecast(forecastData) {
    const today = getTodayStr();
    const days = {};
    for (const item of forecastData.list) {
      const date = item.dt_txt.split(' ')[0];
      if (date === today) continue; // skip today, shown separately
      if (!days[date]) {
        days[date] = { hi: -Infinity, lo: Infinity, icon: item.weather[0].icon, date };
      }
      days[date].hi = Math.max(days[date].hi, item.main.temp_max);
      days[date].lo = Math.min(days[date].lo, item.main.temp_min);
    }
    return Object.values(days).slice(0, 4);
  }

  function getHourlyData(forecastData) {
    // Get next ~12 hours of 3-hour interval data (4-5 points)
    const now = Date.now();
    return forecastData.list
      .filter(item => item.dt * 1000 >= now)
      .slice(0, 5)
      .map(item => ({
        time: new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric' }),
        temp: Math.round(item.main.temp),
        dt: item.dt * 1000
      }));
  }

  function renderHourlyChart(hourly) {
    if (hourly.length < 2) return '';

    const temps = hourly.map(h => h.temp);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const range = maxT - minT || 1;

    // SVG dimensions
    const W = 280;
    const H = 48;
    const padX = 6;
    const padTop = 12;
    const padBot = 3;
    const chartH = H - padTop - padBot;
    const stepX = (W - padX * 2) / (hourly.length - 1);

    // Build points
    const points = hourly.map((h, i) => ({
      x: padX + i * stepX,
      y: padTop + chartH - ((h.temp - minT) / range) * chartH,
      temp: h.temp,
      time: h.time
    }));

    // Smooth line path
    const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');

    // Gradient fill path
    const fillPath = linePath + ` L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;

    // Dots and labels
    const dotsAndLabels = points.map(p => `
      <circle cx="${p.x}" cy="${p.y}" r="2.5" fill="var(--accent)" />
      <text x="${p.x}" y="${p.y - 5}" text-anchor="middle" fill="var(--text)" font-size="8" font-weight="600" font-family="var(--font-mono, monospace)">${p.temp}°</text>
    `).join('');

    // Time labels along bottom
    const timeLabels = points.map(p => `
      <text x="${p.x}" y="${H + 10}" text-anchor="middle" fill="var(--text-muted, #999)" font-size="7" font-family="var(--font-mono, monospace)">${p.time}</text>
    `).join('');

    return `
      <div class="hourly-chart">
        <svg viewBox="0 0 ${W} ${H + 14}" width="100%" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          <path d="${fillPath}" fill="url(#chartGrad)" />
          <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          ${dotsAndLabels}
          ${timeLabels}
        </svg>
      </div>
    `;
  }

  function dayName(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  }

  function renderLocation(current, forecast) {
    const todayHL = getTodayHighLow(forecast, current.main.temp);
    const daily = getDailyForecast(forecast);
    const hourly = getHourlyData(forecast);
    const iconUrl = `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;
    const desc = current.weather[0].description;

    const forecastHtml = daily.map(d => `
      <div class="forecast-day">
        <div>${dayName(d.date)}</div>
        <img src="https://openweathermap.org/img/wn/${d.icon}.png" alt="">
        <div class="temp-range"><span class="temp-hi">${Math.round(d.hi)}°</span> ${Math.round(d.lo)}°</div>
      </div>
    `).join('');

    return `
      <div class="weather-location">
        <div class="weather-location-name">${current.name}</div>
        <div class="weather-current">
          <img class="weather-icon" src="${iconUrl}" alt="${desc}">
          <div class="weather-temp">${Math.round(current.main.temp)}°</div>
          <div class="weather-details">
            ${desc.charAt(0).toUpperCase() + desc.slice(1)}<br>
            H: ${Math.round(todayHL.hi)}° L: ${Math.round(todayHL.lo)}°<br>
            Humidity: ${current.main.humidity}% &bull; Wind: ${Math.round(current.wind.speed)} mph
          </div>
        </div>
        ${renderHourlyChart(hourly)}
        <div class="weather-forecast">${forecastHtml}</div>
      </div>
    `;
  }

  async function refresh() {
    const key = Dashboard.settings.owmKey;
    if (!key) {
      Dashboard.showError(CONTAINER, 'Add your OpenWeatherMap API key in Settings');
      return;
    }

    try {
      const results = await Promise.all(
        LOCATIONS.map(async loc => {
          const [current, forecast] = await Promise.all([
            fetchCurrent(loc.query, key),
            fetchForecast(loc.query, key)
          ]);
          return renderLocation(current, forecast);
        })
      );
      document.getElementById(CONTAINER).innerHTML = results.join('');
      Dashboard.setUpdatedTime(NAME);
    } catch (err) {
      Dashboard.showError(CONTAINER, 'Could not load weather data. Check your API key.');
      console.error('Weather widget error:', err);
    }
  }

  function init() {
    refresh();
    setInterval(refresh, 30 * 60 * 1000);
  }

  Dashboard.registerWidget(NAME, { init, refresh });
})();
