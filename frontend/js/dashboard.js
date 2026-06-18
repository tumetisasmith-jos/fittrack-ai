/* =====================================================
   FitTrack AI — dashboard.js
   Dashboard page logic: stats, quick log, workouts,
   goals, insights, achievements, notifications
   ===================================================== */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
  ? `http://localhost:${window.location.port || 4000}/api` 
  : window.location.origin + '/api';

function getToken() { return localStorage.getItem('fittrack_token'); }
function getUser() { return JSON.parse(localStorage.getItem('fittrack_user') || '{}'); }
function logout() {
  localStorage.removeItem('fittrack_token');
  localStorage.removeItem('fittrack_user');
  window.location.href = 'index.html';
}

if (!getToken()) { window.location.href = 'login.html'; }

async function apiCall(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  };
  if (data) options.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

function showToast(message, type = 'success') {
  const existing = document.querySelectorAll('.toast');
  existing.forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  if (next === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  localStorage.setItem('fittrack_theme', next);
  document.getElementById('themeToggle').innerHTML = next === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function initTheme() {
  const saved = localStorage.getItem('fittrack_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
  }
}

/* ============ Notification system ============ */
let notifications = [];

function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('hidden');
}

// Close notif panel on outside click
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifPanel');
  const bell = document.querySelector('.notification-bell');
  if (!panel.contains(e.target) && !bell.contains(e.target)) {
    panel.classList.add('hidden');
  }
});

async function loadNotifications() {
  try {
    const data = await apiCall('/notifications?limit=10');
    notifications = data.notifications || data || [];
    renderNotifications();
  } catch {
    // Non-critical; fail silently
  }
}

function renderNotifications() {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  const unread = notifications.filter(n => !n.isRead).length;

  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  if (!notifications.length) {
    list.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash" style="font-size:1.5rem;opacity:0.3;margin-bottom:8px;display:block;"></i>No notifications yet</div>';
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.isRead ? '' : 'unread'}">
      <div class="notif-icon"><i class="fas ${getNotifIcon(n.type)}"></i></div>
      <div class="notif-text">
        <p>${n.message || n.title || 'Notification'}</p>
        <span>${timeAgo(n.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

function getNotifIcon(type) {
  const icons = {
    achievement: 'fa-trophy',
    goal: 'fa-bullseye',
    workout: 'fa-dumbbell',
    reminder: 'fa-clock',
    streak: 'fa-fire',
    tip: 'fa-lightbulb',
    default: 'fa-bell'
  };
  return icons[type] || icons.default;
}

async function markAllRead() {
  try {
    await apiCall('/notifications/mark-read', 'PUT');
    notifications = notifications.map(n => ({ ...n, isRead: true }));
    renderNotifications();
  } catch {
    // Fail silently
  }
}

/* ============ Utility helpers ============ */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

/* ============ Greeting ============ */
function setGreeting(name) {
  const hour = new Date().getHours();
  let greet = 'Good evening';
  if (hour >= 5 && hour < 12) greet = 'Good morning';
  else if (hour >= 12 && hour < 17) greet = 'Good afternoon';

  const firstName = (name || 'Athlete').split(' ')[0];
  document.getElementById('greetingText').textContent = `${greet}, ${firstName}! 💪`;

  const now = new Date();
  document.getElementById('greetingDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* ============ Animated count-up ============ */
function animateCountUp(el, target, duration = 1000, decimals = 0, suffix = '') {
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    el.textContent = decimals > 0
      ? current.toFixed(decimals) + suffix
      : Math.round(current).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ============ Today's Stats ============ */
function renderStats(log, profile) {
  // Steps
  const steps = log.steps || 0;
  const stepsGoal = 10000;
  const stepsEl = document.getElementById('stepsVal');
  animateCountUp(stepsEl, steps, 1000);
  const stepsBar = document.getElementById('stepsBar');
  setTimeout(() => { stepsBar.style.width = clamp((steps / stepsGoal) * 100, 0, 100) + '%'; }, 100);
  document.getElementById('stepsGoal').textContent = `Goal: ${stepsGoal.toLocaleString()} • ${steps >= stepsGoal ? '✓ Done!' : Math.max(0, stepsGoal - steps).toLocaleString() + ' to go'}`;

  // Water
  const water = log.water_ml || 0;
  const waterGoal = 2500;
  const waterEl = document.getElementById('waterVal');
  animateCountUp(waterEl, water, 1000);
  const waterBar = document.getElementById('waterBar');
  setTimeout(() => { waterBar.style.width = clamp((water / waterGoal) * 100, 0, 100) + '%'; }, 100);
  document.getElementById('waterGoal').textContent = `Goal: ${waterGoal.toLocaleString()} ml`;

  // Sleep
  const sleep = log.sleep_hours || 0;
  const sleepGoal = 8;
  const sleepEl = document.getElementById('sleepVal');
  animateCountUp(sleepEl, sleep, 1000, 1);
  const sleepBar = document.getElementById('sleepBar');
  setTimeout(() => { sleepBar.style.width = clamp((sleep / sleepGoal) * 100, 0, 100) + '%'; }, 100);
  document.getElementById('sleepGoal').textContent = `Goal: ${sleepGoal} hours`;

  // Calories
  const cals = log.calories_consumed || 0;
  const calsGoal = 2000;
  const calsEl = document.getElementById('caloriesVal');
  animateCountUp(calsEl, cals, 1000);
  const calsBar = document.getElementById('caloriesBar');
  setTimeout(() => { calsBar.style.width = clamp((cals / calsGoal) * 100, 0, 100) + '%'; }, 100);
  document.getElementById('caloriesGoal').textContent = `Goal: ${calsGoal.toLocaleString()} kcal`;

  // BMI
  let bmi = null;
  if (profile && profile.weight_kg && profile.height_cm) {
    const hm = profile.height_cm / 100;
    bmi = profile.weight_kg / (hm * hm);
  }
  const bmiEl = document.getElementById('bmiVal');
  if (bmi) {
    animateCountUp(bmiEl, bmi, 1000, 1);
    const bmiPct = clamp(((bmi - 10) / (40 - 10)) * 100, 0, 100);
    setTimeout(() => { document.getElementById('bmiBar').style.width = bmiPct + '%'; }, 100);
    document.getElementById('bmiCategory').textContent = getBMICategory(bmi);
  } else {
    bmiEl.textContent = 'N/A';
    document.getElementById('bmiCategory').textContent = 'Set height & weight in profile';
  }

  // Distance from steps
  const distEl = document.getElementById('distanceVal');
  if (distEl) {
    // Step length: 0.413 × height_cm / 100 meters; default 0.76m
    const stepLengthM = profile && profile.height_cm ? (profile.height_cm * 0.413 / 100) : 0.76;
    const distKm = parseFloat(((steps * stepLengthM) / 1000).toFixed(2));
    const distGoal = 8; // km
    animateCountUp(distEl, distKm, 1000, 2);
    const distBar = document.getElementById('distanceBar');
    if (distBar) setTimeout(() => { distBar.style.width = clamp((distKm / distGoal) * 100, 0, 100) + '%'; }, 100);
    const distGoalEl = document.getElementById('distanceGoal');
    if (distGoalEl) distGoalEl.textContent = `~${distKm.toFixed(2)} km · ${(stepLengthM * 100).toFixed(0)}cm step`;
  }

  return { steps, water, sleep, cals, bmi };
}

function getBMICategory(bmi) {
  if (bmi < 18.5) return '⚠️ Underweight';
  if (bmi < 25) return '✅ Normal weight';
  if (bmi < 30) return '⚠️ Overweight';
  return '🔴 Obese';
}

/* ============ Quick Log ============ */
async function submitQuickLog(e) {
  e.preventDefault();
  const btn = document.getElementById('quickLogBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const steps = parseInt(document.getElementById('ql-steps').value) || 0;
  const water_ml = parseInt(document.getElementById('ql-water').value) || 0;
  const sleep_hours = parseFloat(document.getElementById('ql-sleep').value) || 0;
  const calories_consumed = parseInt(document.getElementById('ql-calories').value) || 0;

  if (!steps && !water_ml && !sleep_hours && !calories_consumed) {
    showToast('Please enter at least one value to log.', 'info');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Today\'s Log';
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    await apiCall('/daily-logs', 'POST', {
      date: today,
      steps,
      water_ml,
      sleep_hours,
      calories_consumed
    });
    showToast('Today\'s log saved successfully! 🎉');
    // Reload stats
    await loadDashboardData();
  } catch (err) {
    showToast(err.message || 'Failed to save log', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Today\'s Log';
  }
}

/* ============ Recent Workouts ============ */
const workoutIcons = {
  running: 'fa-person-running', cycling: 'fa-bicycle', yoga: 'fa-spa',
  strength: 'fa-dumbbell', strength_training: 'fa-dumbbell',
  swimming: 'fa-person-swimming', hiit: 'fa-bolt', walking: 'fa-person-walking',
  pilates: 'fa-child-reaching', boxing: 'fa-hand-back-fist',
  basketball: 'fa-basketball', other: 'fa-heart-pulse'
};

function getWorkoutIcon(type) {
  const key = (type || 'other').toLowerCase().replace(/\s+/g, '_');
  return workoutIcons[key] || 'fa-heart-pulse';
}

function getWorkoutTypeCss(type) {
  const key = (type || 'other').toLowerCase().replace(/\s+/g, '_');
  return `type-${key}`;
}

function renderRecentWorkouts(workouts) {
  const container = document.getElementById('recentWorkoutsList');
  if (!workouts || !workouts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-dumbbell"></i>
        No workouts logged yet.<br>
        <a href="workouts.html" class="panel-link" style="margin-top:8px;display:inline-block;">Log your first workout →</a>
      </div>`;
    return;
  }

  const recent = workouts.slice(0, 3);
  container.innerHTML = recent.map(w => {
    const typeCss = getWorkoutTypeCss(w.type);
    const icon = getWorkoutIcon(w.type);
    return `
      <div class="workout-item">
        <div class="workout-type-icon ${typeCss}">
          <i class="fas ${icon}"></i>
        </div>
        <div class="workout-info">
          <div class="workout-name">${capitalize(w.type || 'Workout')}</div>
          <div class="workout-meta">
            <span><i class="fas fa-clock"></i> ${w.duration_minutes} min</span>
            ${w.calories_burned ? `<span><i class="fas fa-fire"></i> ${w.calories_burned} kcal</span>` : ''}
          </div>
        </div>
        <div class="workout-date">${formatDate(w.date || w.createdAt)}</div>
      </div>`;
  }).join('');
}

/* ============ Goals ============ */
function renderGoals(goals) {
  const container = document.getElementById('goalsList');
  if (!goals || !goals.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bullseye"></i>
        No active goals.<br>
        <a href="goals.html" class="panel-link" style="margin-top:8px;display:inline-block;">Set your first goal →</a>
      </div>`;
    return;
  }

  const active = goals.filter(g => g.status === 'active' || !g.status).slice(0, 3);
  if (!active.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle"></i> All goals completed! 🎉</div>`;
    return;
  }

  container.innerHTML = active.map(g => {
    const pct = g.target_value > 0 ? clamp(Math.round((g.current_value / g.target_value) * 100), 0, 100) : 0;
    return `
      <div class="goal-item">
        <div class="goal-header">
          <span class="goal-name">${g.title || g.goal_type || 'Goal'}</span>
          <span class="goal-pct">${pct}%</span>
        </div>
        <div class="goal-progress-wrap">
          <div class="goal-progress-bar" style="width:0%" data-target="${pct}"></div>
        </div>
        <div class="goal-meta">${g.current_value || 0} / ${g.target_value || 0} ${g.unit || ''}</div>
      </div>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    container.querySelectorAll('.goal-progress-bar').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  }, 200);
}

/* ============ Insights ============ */
function generateInsights(stats, weeklyData) {
  const insights = [];
  const { steps, water, sleep, cals, bmi } = stats;

  // Steps insights
  if (steps === 0) {
    insights.push({ icon: 'fa-shoe-prints', type: 'tip', text: '👟 You haven\'t logged any steps yet today. Start with a quick 10-minute walk!' });
  } else if (steps < 5000) {
    insights.push({ icon: 'fa-shoe-prints', type: 'warning', text: `You\'re at ${steps.toLocaleString()} steps. Try a short walk to get closer to your 10,000 step goal!` });
  } else if (steps >= 10000) {
    insights.push({ icon: 'fa-trophy', type: 'success', text: `🔥 Amazing! You crushed your step goal with ${steps.toLocaleString()} steps today!` });
  } else {
    insights.push({ icon: 'fa-shoe-prints', type: 'info', text: `You\'re at ${steps.toLocaleString()} steps — just ${(10000 - steps).toLocaleString()} more to hit your goal!` });
  }

  // Water insights
  if (water < 1000 && water > 0) {
    insights.push({ icon: 'fa-tint', type: 'warning', text: '💧 Low hydration alert! You\'ve only had ' + water + ' ml. Try to drink water every hour.' });
  } else if (water < 2000 && water > 0) {
    insights.push({ icon: 'fa-tint', type: 'warning', text: `💧 Stay hydrated! You\'ve had ${water} ml. Drink 2 more glasses to reach your goal.` });
  } else if (water >= 2500) {
    insights.push({ icon: 'fa-tint', type: 'success', text: '💧 Great hydration! You\'ve met your daily water intake goal. Keep it up!' });
  }

  // Sleep insights
  if (sleep > 0 && sleep < 6) {
    insights.push({ icon: 'fa-moon', type: 'warning', text: `😴 You slept only ${sleep} hours. Less than 6 hours can impact recovery and focus. Aim for 7–9 hours.` });
  } else if (sleep >= 7 && sleep <= 9) {
    insights.push({ icon: 'fa-moon', type: 'success', text: `✨ Great sleep! ${sleep} hours of sleep means your body is well-recovered and ready to perform.` });
  } else if (sleep > 9) {
    insights.push({ icon: 'fa-moon', type: 'info', text: `😴 You slept ${sleep} hours. While rest is important, oversleeping can sometimes cause grogginess.` });
  }

  // Calories
  if (cals > 0 && cals < 1200) {
    insights.push({ icon: 'fa-fire', type: 'warning', text: '⚡ Your calorie intake seems very low. Make sure you\'re fueling your body adequately for exercise.' });
  } else if (cals > 2500) {
    insights.push({ icon: 'fa-fire', type: 'info', text: `🍽️ You\'ve consumed ${cals.toLocaleString()} kcal today. Consider balancing with physical activity if above your target.` });
  }

  // BMI
  if (bmi) {
    if (bmi < 18.5) {
      insights.push({ icon: 'fa-weight', type: 'warning', text: `Your BMI is ${bmi.toFixed(1)} (underweight). Consider consulting a nutritionist for a healthy weight gain plan.` });
    } else if (bmi >= 18.5 && bmi < 25) {
      insights.push({ icon: 'fa-weight', type: 'success', text: `Your BMI is ${bmi.toFixed(1)} — right in the healthy range! Keep maintaining your great habits.` });
    }
  }

  // Weekly comparison
  if (weeklyData && weeklyData.thisWeekSteps && weeklyData.lastWeekSteps && weeklyData.lastWeekSteps > 0) {
    const diff = weeklyData.thisWeekSteps - weeklyData.lastWeekSteps;
    const pctChange = Math.round((diff / weeklyData.lastWeekSteps) * 100);
    if (pctChange > 0) {
      insights.push({ icon: 'fa-chart-line', type: 'success', text: `📈 You have ${pctChange}% more steps this week vs last week. Great trend!` });
    } else if (pctChange < -10) {
      insights.push({ icon: 'fa-chart-line', type: 'warning', text: `📉 Your steps are ${Math.abs(pctChange)}% lower than last week. Try to stay consistent!` });
    }
  }

  return insights.slice(0, 5);
}

function renderInsights(insights) {
  const container = document.getElementById('insightsList');
  if (!insights || !insights.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-lightbulb"></i> Log your activity to get personalized insights!</div>';
    return;
  }
  container.innerHTML = insights.map(i => `
    <div class="insight-card">
      <div class="insight-icon ${i.type}"><i class="fas ${i.icon}"></i></div>
      <p class="insight-text">${i.text}</p>
    </div>
  `).join('');
}

/* ============ Achievements ============ */
function renderAchievements(achievements) {
  const container = document.getElementById('achievementsGrid');
  if (!achievements || !achievements.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-medal"></i> Complete workouts and goals to earn badges!</div>`;
    return;
  }

  const recent = achievements.slice(0, 3);
  container.innerHTML = recent.map(a => `
    <div class="achievement-card">
      <span class="achievement-icon">${a.icon || '🏅'}</span>
      <div class="achievement-name">${a.name || a.title || 'Achievement'}</div>
      <div class="achievement-desc">${a.description || ''}</div>
    </div>
  `).join('');
}

/* ============ Level / XP ============ */
function renderLevelXP(profile) {
  const xp = profile.xp || 0;
  const level = profile.level || 1;
  const xpForNext = level * 100;
  const xpInLevel = xp % xpForNext;
  const xpPct = Math.min((xpInLevel / xpForNext) * 100, 100);

  const titles = [
    '', 'Fitness Beginner', 'Active Starter', 'Motivated Mover',
    'Consistent Trainer', 'Fitness Enthusiast', 'Health Warrior',
    'Peak Performer', 'Elite Athlete', 'Fitness Legend', 'FitTrack Master'
  ];
  const title = titles[Math.min(level, titles.length - 1)] || `Level ${level} Athlete`;

  document.getElementById('levelNum').textContent = level;
  document.getElementById('levelTitle').textContent = title;
  document.getElementById('levelXpText').textContent = `${xpInLevel.toLocaleString()} / ${xpForNext.toLocaleString()} XP to next level`;

  setTimeout(() => {
    document.getElementById('xpBar').style.width = xpPct + '%';
  }, 200);
}

/* ============ User Avatar ============ */
function setUserAvatar(user) {
  const el = document.getElementById('userAvatar');
  const name = user.full_name || user.username || 'U';
  const initials = name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
  el.textContent = initials;
}

/* ============ Capitalize ============ */
function capitalize(str) {
  if (!str) return '';
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ============ Main Load ============ */
let dashboardData = {};

async function loadDashboardData() {
  try {
    // Load user profile
    const profile = await apiCall('/users/me');
    dashboardData.profile = profile;
    setGreeting(profile.full_name || profile.username);
    setUserAvatar(profile);
    if (profile.level !== undefined) renderLevelXP(profile);

    // Load today's log
    const today = new Date().toISOString().split('T')[0];
    let todayLog = {};
    try {
      const logsRes = await apiCall(`/daily-logs?date=${today}`);
      const logs = logsRes.logs || logsRes;
      todayLog = Array.isArray(logs) ? (logs[0] || {}) : logsRes;
    } catch {
      todayLog = {};
    }
    dashboardData.todayLog = todayLog;

    // Pre-fill quick log form
    if (todayLog.steps) document.getElementById('ql-steps').value = todayLog.steps;
    if (todayLog.water_ml) document.getElementById('ql-water').value = todayLog.water_ml;
    if (todayLog.sleep_hours) document.getElementById('ql-sleep').value = todayLog.sleep_hours;
    if (todayLog.calories_consumed) document.getElementById('ql-calories').value = todayLog.calories_consumed;

    // Render stats
    const stats = renderStats(todayLog, profile);

    // Load workouts
    try {
      const wkRes = await apiCall('/workouts?limit=5');
      const workouts = wkRes.workouts || wkRes || [];
      dashboardData.workouts = workouts;
      renderRecentWorkouts(workouts);
    } catch {
      renderRecentWorkouts([]);
    }

    // Load goals
    try {
      const goalsRes = await apiCall('/goals?status=active');
      const goals = goalsRes.goals || goalsRes || [];
      dashboardData.goals = goals;
      renderGoals(goals);
    } catch {
      renderGoals([]);
    }

    // Load weekly comparison for insights
    let weeklyData = {};
    try {
      const weekRes = await apiCall('/daily-logs?days=14');
      const logs = weekRes.logs || weekRes || [];
      if (Array.isArray(logs) && logs.length > 0) {
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const thisWeekLogs = logs.filter(l => new Date(l.date) >= weekAgo);
        const lastWeekLogs = logs.filter(l => new Date(l.date) >= twoWeeksAgo && new Date(l.date) < weekAgo);
        weeklyData.thisWeekSteps = thisWeekLogs.reduce((s, l) => s + (l.steps || 0), 0);
        weeklyData.lastWeekSteps = lastWeekLogs.reduce((s, l) => s + (l.steps || 0), 0);
      }
    } catch { /* ignore */ }

    // Generate and render insights
    const insights = generateInsights(stats, weeklyData);
    renderInsights(insights);

    // Load achievements
    try {
      const achRes = await apiCall('/achievements');
      const achievements = achRes.achievements || achRes || [];
      renderAchievements(achievements);
    } catch {
      renderAchievements([]);
    }

    // Load notifications (non-critical)
    await loadNotifications();

  } catch (err) {
    console.error('Dashboard load error:', err);
    if (err.message && err.message.includes('401')) {
      logout();
    } else {
      showToast('Some data failed to load. Please refresh.', 'error');
    }
  }
}

/* ============ Init ============ */
initTheme();

// Mark active nav
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  if (item.getAttribute('data-page') === 'dashboard') item.classList.add('active');
});

// Greeting default
setGreeting('');
const now = new Date();
document.getElementById('greetingDate').textContent = now.toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// Load data on DOM ready
document.addEventListener('DOMContentLoaded', loadDashboardData);
