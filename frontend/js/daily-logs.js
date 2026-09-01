// ── Auth & Helpers ──────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://fittrack-ai.onrender.com/api';
function getToken() { return localStorage.getItem('fittrack_token'); }
function getUser() { return JSON.parse(localStorage.getItem('fittrack_user') || '{}'); }
function logout() { localStorage.removeItem('fittrack_token'); localStorage.removeItem('fittrack_user'); window.location.href = 'index.html'; }
if (!getToken()) { window.location.href = 'login.html'; }

async function apiCall(endpoint, method = 'GET', data = null) {
  const options = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` } };
  if (data) options.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('fittrack_theme', isDark ? 'light' : 'dark');
}
function initTheme() {
  if (localStorage.getItem('fittrack_theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');
}
initTheme();

// ── State ────────────────────────────────────────────────────────────────────
let selectedMood = null;
let selectedEnergy = null;
let waterUnit = 'ml';
let allLogs = [];
let todayLog = null;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl && user.name) avatarEl.textContent = user.name.charAt(0).toUpperCase();

  // Set min date for today's log
  const today = new Date();
  const minDate = new Date(today); minDate.setDate(today.getDate() - 30);

  loadTodayLog();
  loadHistory();
});

// ── Load today's log ─────────────────────────────────────────────────────────
async function loadTodayLog() {
  try {
    const data = await apiCall('/daily-logs/today');
    todayLog = data.log || null;
    if (todayLog) prefillForm(todayLog);
  } catch (err) {
    // 404 means no log yet — that's fine
    if (!err.message.includes('404') && !err.message.includes('No log')) {
      console.warn('Could not load today log:', err.message);
    }
  }
}

function prefillForm(log) {
  if (log.steps) document.getElementById('steps').value = log.steps;
  if (log.water_ml) document.getElementById('water').value = log.water_ml;
  if (log.sleep_hours) {
    document.getElementById('sleepSlider').value = log.sleep_hours;
    updateSleepDisplay(log.sleep_hours);
  }
  if (log.calories_burned) document.getElementById('caloriesBurned').value = log.calories_burned;
  if (log.weight_kg) document.getElementById('weight').value = log.weight_kg;
  if (log.mood) selectMood(log.mood);
  if (log.energy_level) selectEnergy(log.energy_level);

  // Change button text to indicate update
  const btn = document.getElementById('submitBtn');
  btn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Today';
}

// ── Load 30-day history ──────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const data = await apiCall('/daily-logs');
    allLogs = Array.isArray(data.logs) ? data.logs : (Array.isArray(data) ? data : []);
    renderHistory(allLogs);
    renderSummary(allLogs);
    renderStreak(allLogs);
  } catch (err) {
    console.error('History load error:', err);
    const body = document.getElementById('historyBody');
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--accent-red)"><i class="fas fa-exclamation-circle"></i> Failed to load history</td></tr>`;
  }
}

// ── Render history table ─────────────────────────────────────────────────────
function renderHistory(logs) {
  const body = document.getElementById('historyBody');
  if (!logs.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-calendar-times"></i>No logs yet — start tracking today!</div></td></tr>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...logs].sort((a, b) => new Date(b.date || b.log_date) - new Date(a.date || a.log_date));

  body.innerHTML = sorted.map(log => {
    const dateStr = log.date || log.log_date || '';
    const isToday = dateStr === today;
    const displayDate = isToday ? 'Today' : formatDate(dateStr);

    return `
      <tr class="${isToday ? 'today-row' : ''}">
        <td class="date-col">${displayDate}</td>
        <td>${stepsPill(log.steps)}</td>
        <td>${waterPill(log.water_ml)}</td>
        <td>${sleepPill(log.sleep_hours)}</td>
        <td>${calsPill(log.calories_burned)}</td>
        <td class="mood-cell">${moodEmoji(log.mood)}</td>
        <td>${energyStars(log.energy_level)}</td>
      </tr>`;
  }).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function stepsPill(v) {
  if (!v && v !== 0) return '<span class="pill pill-gray">—</span>';
  const cls = v >= 10000 ? 'pill-green' : v >= 6000 ? 'pill-yellow' : 'pill-red';
  return `<span class="pill ${cls}">${(+v).toLocaleString()}</span>`;
}

function waterPill(v) {
  if (!v && v !== 0) return '<span class="pill pill-gray">—</span>';
  const cls = v >= 2000 ? 'pill-green' : v >= 1200 ? 'pill-yellow' : 'pill-red';
  return `<span class="pill ${cls}">${v}ml</span>`;
}

function sleepPill(v) {
  if (!v && v !== 0) return '<span class="pill pill-gray">—</span>';
  const cls = (v >= 7 && v <= 9) ? 'pill-green' : (v >= 6 || v <= 10) ? 'pill-yellow' : 'pill-red';
  return `<span class="pill ${cls}">${v}h</span>`;
}

function calsPill(v) {
  if (!v && v !== 0) return '<span class="pill pill-gray">—</span>';
  const cls = v >= 400 ? 'pill-green' : v >= 200 ? 'pill-yellow' : 'pill-red';
  return `<span class="pill ${cls}">${(+v).toLocaleString()}</span>`;
}

function moodEmoji(v) {
  const emojis = { 1: '😢', 2: '😞', 3: '😐', 4: '😊', 5: '😄' };
  return emojis[v] || '—';
}

function energyStars(v) {
  if (!v) return '—';
  return '⭐'.repeat(Math.min(5, Math.max(0, +v)));
}

// ── Render weekly summary ────────────────────────────────────────────────────
function renderSummary(logs) {
  // Last 7 days
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const week = logs.filter(l => new Date(l.date || l.log_date) >= cutoff);

  const avg = (arr, key) => {
    const vals = arr.map(l => +(l[key] || 0)).filter(v => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  document.getElementById('avgSteps').textContent = avg(week, 'steps').toLocaleString();
  document.getElementById('avgWater').textContent = avg(week, 'water_ml') + 'ml';
  document.getElementById('avgSleep').textContent = avg(week, 'sleep_hours') + 'h';
  document.getElementById('avgCals').textContent = avg(week, 'calories_burned').toLocaleString();
  document.getElementById('totalLogs').textContent = logs.length;
}

// ── Render streak ─────────────────────────────────────────────────────────────
function renderStreak(logs) {
  const dates = logs.map(l => l.date || l.log_date).filter(Boolean).sort().reverse();
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (dates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  const el = document.getElementById('streakText');
  if (streak === 0) {
    el.textContent = 'Start your streak!';
  } else if (streak === 1) {
    el.textContent = '1 day streak 🔥';
  } else {
    el.textContent = `${streak} day streak! 🔥`;
  }
}

// ── Form controls ─────────────────────────────────────────────────────────────
function updateSleepDisplay(val) {
  document.getElementById('sleepDisplay').textContent = parseFloat(val) % 1 === 0 ? val + 'h' : val + 'h';
}

function selectMood(val) {
  selectedMood = +val;
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.mood === selectedMood);
  });
}

function selectEnergy(val) {
  selectedEnergy = +val;
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.star <= selectedEnergy);
  });
}

function setWaterUnit(unit) {
  waterUnit = unit;
  document.getElementById('btnMl').classList.toggle('active', unit === 'ml');
  document.getElementById('btnGlass').classList.toggle('active', unit === 'glass');
  const input = document.getElementById('water');
  input.placeholder = unit === 'ml' ? 'ml (e.g. 2000)' : 'glasses (e.g. 8)';
}

// ── Form submit ───────────────────────────────────────────────────────────────
async function submitLog(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

  try {
    let waterMl = +(document.getElementById('water').value || 0);
    if (waterUnit === 'glass') waterMl = waterMl * 250; // 1 glass ≈ 250ml

    const payload = {
      steps: +(document.getElementById('steps').value) || null,
      water_ml: waterMl || null,
      sleep_hours: parseFloat(document.getElementById('sleepSlider').value) || null,
      calories_burned: +(document.getElementById('caloriesBurned').value) || null,
      weight_kg: parseFloat(document.getElementById('weight').value) || null,
      mood: selectedMood || null,
      energy_level: selectedEnergy || null,
    };

    // Remove null fields
    Object.keys(payload).forEach(k => payload[k] === null && delete payload[k]);

    await apiCall('/daily-logs', 'POST', payload);
    showToast('Daily log saved! 🎉', 'success');

    // Reload data
    await loadHistory();
    todayLog = payload;

    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Today';
  } catch (err) {
    showToast(err.message || 'Failed to save log', 'error');
    btn.innerHTML = '<i class="fas fa-check"></i> Log Today';
  } finally {
    btn.disabled = false;
  }
}
