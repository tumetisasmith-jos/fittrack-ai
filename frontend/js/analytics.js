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

// ── Chart.js global defaults ─────────────────────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
Chart.defaults.font.family = 'Inter';

// ── State ─────────────────────────────────────────────────────────────────────
let currentRange = 14;
let allLogs = [];
let allWorkouts = [];
const chartInstances = {};

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  const el = document.getElementById('userAvatar');
  if (el && user.name) el.textContent = user.name.charAt(0).toUpperCase();

  document.querySelector('.range-tab[data-range="14"]').classList.add('active');

  await loadData();
});

// ── Load data ─────────────────────────────────────────────────────────────────
async function loadData() {
  showLoading(true);
  try {
    const [logsRes, workoutsRes] = await Promise.allSettled([
      apiCall('/daily-logs'),
      apiCall('/workouts'),
    ]);

    if (logsRes.status === 'fulfilled') {
      const d = logsRes.value;
      allLogs = Array.isArray(d.logs) ? d.logs : (Array.isArray(d) ? d : []);
    }
    if (workoutsRes.status === 'fulfilled') {
      const d = workoutsRes.value;
      allWorkouts = Array.isArray(d.workouts) ? d.workouts : (Array.isArray(d) ? d : []);
    }

    renderAll();
  } catch (err) {
    showToast('Failed to load analytics: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

// ── Set range ─────────────────────────────────────────────────────────────────
function setRange(days) {
  currentRange = days;
  document.querySelectorAll('.range-tab').forEach(t => {
    t.classList.toggle('active', +t.dataset.range === days);
  });
  renderAll();
}

// ── Get date range ────────────────────────────────────────────────────────────
function getDateRange(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function filterByRange(arr, dateKey = 'date') {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - currentRange);
  return arr.filter(item => {
    const d = new Date(item[dateKey] || item.created_at || item.workout_date);
    return d >= cutoff;
  });
}

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
  const filteredLogs = filterByRange(allLogs);
  const filteredWorkouts = filterByRange(allWorkouts, 'workout_date');
  const dates = getDateRange(currentRange);

  renderStats(filteredLogs, filteredWorkouts);
  buildStepsChart(filteredLogs, dates);
  buildCaloriesChart(filteredLogs, dates);
  buildWorkoutChart(filteredWorkouts);
  buildWeightChart(filteredLogs, dates);
  buildSleepChart(filteredLogs, dates);
  buildWaterChart(filteredLogs, dates);
  buildHeatmapChart(filteredLogs, filteredWorkouts, dates);
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function renderStats(logs, workouts) {
  const avg = (arr, key) => {
    const vals = arr.map(l => +(l[key] || 0)).filter(v => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  document.getElementById('st-steps').textContent = avg(logs, 'steps').toLocaleString();
  document.getElementById('st-cals').textContent = avg(logs, 'calories_burned').toLocaleString();
  document.getElementById('st-sleep').textContent = avg(logs, 'sleep_hours') + 'h';
  document.getElementById('st-water').textContent = avg(logs, 'water_ml').toLocaleString();
  document.getElementById('st-workouts').textContent = workouts.length;

  // Simple trend indicator (compare first half vs second half)
  addTrend('st-steps-t', logs, 'steps');
  addTrend('st-cals-t', logs, 'calories_burned');
  addTrend('st-sleep-t', logs, 'sleep_hours');
  addTrend('st-water-t', logs, 'water_ml');
}

function addTrend(elId, arr, key) {
  const el = document.getElementById(elId);
  if (!el || arr.length < 4) { if (el) el.textContent = ''; return; }
  const mid = Math.floor(arr.length / 2);
  const firstHalf = arr.slice(0, mid).map(l => +(l[key] || 0)).filter(Boolean);
  const secondHalf = arr.slice(mid).map(l => +(l[key] || 0)).filter(Boolean);
  if (!firstHalf.length || !secondHalf.length) { el.textContent = ''; return; }
  const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = Math.round(((avg2 - avg1) / avg1) * 100);
  if (diff > 0) {
    el.innerHTML = `<i class="fas fa-arrow-up"></i> ${diff}% vs prior period`;
    el.className = 's-trend trend-up';
  } else if (diff < 0) {
    el.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(diff)}% vs prior period`;
    el.className = 's-trend trend-down';
  } else {
    el.textContent = 'Stable';
    el.className = 's-trend';
  }
}

// ── Destroy & create charts ───────────────────────────────────────────────────
function destroyChart(key) {
  if (chartInstances[key]) { chartInstances[key].destroy(); delete chartInstances[key]; }
}

function makeGradient(ctx, color1, color2) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

function mapLogsToDate(logs, key, dates) {
  const map = {};
  logs.forEach(l => { map[l.date || l.log_date] = +(l[key] || 0); });
  return dates.map(d => map[d] || 0);
}

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Steps chart (line, cyan gradient) ────────────────────────────────────────
function buildStepsChart(logs, dates) {
  destroyChart('steps');
  const ctx = document.getElementById('stepsChart').getContext('2d');
  const gradient = makeGradient(ctx, 'rgba(6,182,212,0.4)', 'rgba(6,182,212,0.02)');
  const values = mapLogsToDate(logs, 'steps', dates);

  chartInstances.steps = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(shortDate),
      datasets: [{
        label: 'Steps',
        data: values,
        borderColor: '#06b6d4',
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#06b6d4',
        pointRadius: 3,
        pointHoverRadius: 6,
      }]
    },
    options: chartOptions({ yLabel: 'Steps', tooltip: v => v.toLocaleString() + ' steps' })
  });
}

// ── Calories bar chart (orange) ───────────────────────────────────────────────
function buildCaloriesChart(logs, dates) {
  destroyChart('calories');
  const ctx = document.getElementById('caloriesChart').getContext('2d');
  const gradient = makeGradient(ctx, 'rgba(245,158,11,0.8)', 'rgba(245,158,11,0.2)');
  const values = mapLogsToDate(logs, 'calories_burned', dates);

  chartInstances.calories = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates.map(shortDate),
      datasets: [{
        label: 'Calories',
        data: values,
        backgroundColor: gradient,
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: chartOptions({ yLabel: 'kcal', tooltip: v => v.toLocaleString() + ' kcal' })
  });
}

// ── Workout doughnut ──────────────────────────────────────────────────────────
function buildWorkoutChart(workouts) {
  destroyChart('workout');
  const ctx = document.getElementById('workoutChart').getContext('2d');

  // Count by type
  const typeCounts = {};
  workouts.forEach(w => {
    const t = w.workout_type || w.type || 'Other';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const labels = Object.keys(typeCounts);
  const values = Object.values(typeCounts);
  const COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#6366f1','#84cc16'];

  chartInstances.workout = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: labels.length ? COLORS.slice(0, labels.length) : ['rgba(255,255,255,0.1)'],
        borderColor: 'rgba(255,255,255,0.05)',
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8', padding: 14, font: { size: 12 }, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(15,15,42,0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} workouts`
          }
        }
      },
      animation: { animateRotate: true, duration: 800 }
    }
  });
}

// ── Weight line chart (green + target) ───────────────────────────────────────
function buildWeightChart(logs, dates) {
  destroyChart('weight');
  const ctx = document.getElementById('weightChart').getContext('2d');
  const gradient = makeGradient(ctx, 'rgba(16,185,129,0.3)', 'rgba(16,185,129,0.02)');

  const weightMap = {};
  logs.forEach(l => { if (l.weight_kg) weightMap[l.date || l.log_date] = +l.weight_kg; });
  const values = dates.map(d => weightMap[d] || null);

  // Target line from user profile
  const user = getUser();
  const targetWeight = user.goal_weight_kg || null;

  const datasets = [{
    label: 'Weight (kg)',
    data: values,
    borderColor: '#10b981',
    backgroundColor: gradient,
    borderWidth: 2.5,
    fill: true,
    tension: 0.3,
    pointBackgroundColor: '#10b981',
    pointRadius: 3,
    pointHoverRadius: 6,
    spanGaps: true,
  }];

  if (targetWeight) {
    datasets.push({
      label: 'Target',
      data: dates.map(() => targetWeight),
      borderColor: 'rgba(239,68,68,0.6)',
      borderDash: [6, 4],
      borderWidth: 2,
      fill: false,
      pointRadius: 0,
      tension: 0,
    });
  }

  chartInstances.weight = new Chart(ctx, {
    type: 'line',
    data: { labels: dates.map(shortDate), datasets },
    options: chartOptions({ yLabel: 'kg', tooltip: v => v ? v + ' kg' : 'No data' })
  });
}

// ── Sleep area chart (purple) ─────────────────────────────────────────────────
function buildSleepChart(logs, dates) {
  destroyChart('sleep');
  const ctx = document.getElementById('sleepChart').getContext('2d');
  const gradient = makeGradient(ctx, 'rgba(124,58,237,0.5)', 'rgba(124,58,237,0.02)');
  const values = mapLogsToDate(logs, 'sleep_hours', dates);

  chartInstances.sleep = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(shortDate),
      datasets: [{
        label: 'Sleep (hours)',
        data: values,
        borderColor: '#7c3aed',
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#7c3aed',
        pointRadius: 3,
        pointHoverRadius: 6,
      }, {
        label: 'Ideal (8h)',
        data: dates.map(() => 8),
        borderColor: 'rgba(16,185,129,0.4)',
        borderDash: [5, 4],
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        tension: 0,
      }]
    },
    options: {
      ...chartOptions({ yLabel: 'Hours', tooltip: v => v + 'h' }),
      scales: {
        ...chartOptions({ yLabel: 'Hours' }).scales,
        y: { ...chartOptions({ yLabel: 'Hours' }).scales?.y, min: 0, max: 12 }
      }
    }
  });
}

// ── Water bar chart (blue) ────────────────────────────────────────────────────
function buildWaterChart(logs, dates) {
  destroyChart('water');
  const ctx = document.getElementById('waterChart').getContext('2d');
  const gradient = makeGradient(ctx, 'rgba(59,130,246,0.8)', 'rgba(59,130,246,0.2)');
  const values = mapLogsToDate(logs, 'water_ml', dates);

  chartInstances.water = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates.map(shortDate),
      datasets: [{
        label: 'Water (ml)',
        data: values,
        backgroundColor: gradient,
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: chartOptions({ yLabel: 'ml', tooltip: v => v.toLocaleString() + ' ml' })
  });
}

// ── Activity heatmap (composite bar) ─────────────────────────────────────────
function buildHeatmapChart(logs, workouts, dates) {
  destroyChart('heatmap');
  const ctx = document.getElementById('heatmapChart').getContext('2d');

  const logMap = {};
  logs.forEach(l => { logMap[l.date || l.log_date] = l; });

  const workoutMap = {};
  workouts.forEach(w => {
    const d = (w.workout_date || w.created_at || '').slice(0, 10);
    workoutMap[d] = (workoutMap[d] || 0) + 1;
  });

  const values = dates.map(d => {
    const log = logMap[d] || {};
    const steps = Math.min(+(log.steps || 0) / 200, 30);
    const cals = Math.min(+(log.calories_burned || 0) / 20, 25);
    const workoutBonus = (workoutMap[d] || 0) * 15;
    return Math.round(steps + cals + workoutBonus);
  });

  const maxVal = Math.max(...values, 1);
  const colors = values.map(v => {
    const ratio = v / maxVal;
    if (ratio > 0.75) return '#10b981';
    if (ratio > 0.5) return '#06b6d4';
    if (ratio > 0.25) return '#f59e0b';
    if (ratio > 0) return '#ef4444';
    return 'rgba(255,255,255,0.06)';
  });

  chartInstances.heatmap = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates.map(shortDate),
      datasets: [{
        label: 'Activity Score',
        data: values,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,15,42,0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` Activity score: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b', maxRotation: 45, font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } } }
      },
      animation: { duration: 600 }
    }
  });
}

// ── Shared chart options ──────────────────────────────────────────────────────
function chartOptions({ yLabel = '', tooltip = v => v } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,15,42,0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: ctx => ` ${tooltip(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', maxRotation: 45, font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#64748b', font: { size: 11 } },
        beginAtZero: true,
      }
    },
    animation: { duration: 600, easing: 'easeInOutQuart' },
    interaction: { intersect: false, mode: 'index' }
  };
}

// ── Export report ─────────────────────────────────────────────────────────────
function exportReport() {
  const user = getUser();
  const filteredLogs = filterByRange(allLogs);
  const filteredWorkouts = filterByRange(allWorkouts, 'workout_date');
  const now = new Date().toLocaleString();

  const avg = (arr, key) => {
    const vals = arr.map(l => +(l[key] || 0)).filter(v => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  const lines = [
    'FitTrack AI — Analytics Report',
    '='.repeat(40),
    `Generated: ${now}`,
    `User: ${user.name || 'Unknown'} | Period: Last ${currentRange} days`,
    '',
    '── SUMMARY ──',
    `Total logs recorded:   ${filteredLogs.length} days`,
    `Total workouts:        ${filteredWorkouts.length}`,
    `Avg daily steps:       ${avg(filteredLogs, 'steps').toLocaleString()}`,
    `Avg calories burned:   ${avg(filteredLogs, 'calories_burned').toLocaleString()} kcal`,
    `Avg sleep:             ${avg(filteredLogs, 'sleep_hours')} hours`,
    `Avg water intake:      ${avg(filteredLogs, 'water_ml').toLocaleString()} ml`,
    '',
    '── DAILY LOG DETAILS ──',
    'Date        | Steps   | Water  | Sleep | Calories',
    '-'.repeat(55),
    ...filteredLogs.sort((a, b) => new Date(b.date || b.log_date) - new Date(a.date || a.log_date)).map(l => {
      const d = (l.date || l.log_date || '').slice(0, 10).padEnd(10);
      const s = String(l.steps || 0).padEnd(7);
      const w = String((l.water_ml || 0) + 'ml').padEnd(6);
      const sl = String((l.sleep_hours || 0) + 'h').padEnd(5);
      const c = String(l.calories_burned || 0).padEnd(8);
      return `${d} | ${s} | ${w} | ${sl} | ${c}`;
    }),
    '',
    '── WORKOUTS ──',
    ...filteredWorkouts.map(w => `• ${(w.workout_date || '').slice(0, 10)} — ${w.workout_type || w.type || 'Unknown'} (${w.duration_minutes || '?'} min, ${w.calories_burned || '?'} kcal)`),
    '',
    '='.repeat(40),
    'FitTrack AI — Your Health, Tracked.',
  ];

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fittrack-report-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report downloaded!', 'success');
}
