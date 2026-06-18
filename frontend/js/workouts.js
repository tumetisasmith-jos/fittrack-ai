// ─── FitTrack AI — Workouts Page ─────────────────────────────────────────────
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `http://localhost:${window.location.port || 4000}/api`
  : window.location.origin + '/api';

function logout() { clearAuth(); window.location.href = 'index.html'; }

async function apiCall(endpoint, method = 'GET', data = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` } };
  if (data) opts.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${msg}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

const DEMO_WORKOUTS = [
  { id: 1, type: 'Running', duration_minutes: 45, calories_burned: 420, date: '2026-06-09', notes: 'Morning run — felt great' },
  { id: 2, type: 'HIIT', duration_minutes: 35, calories_burned: 380, date: '2026-06-07', notes: 'Tabata intervals' },
  { id: 3, type: 'Strength Training', duration_minutes: 60, calories_burned: 290, date: '2026-06-05', notes: 'Upper body focus' },
  { id: 4, type: 'Yoga', duration_minutes: 40, calories_burned: 120, date: '2026-06-03', notes: 'Recovery session' },
  { id: 5, type: 'Cycling', duration_minutes: 50, calories_burned: 450, date: '2026-06-01', notes: 'Outdoor trail ride' }
];

const DEMO_STATS = {
  total_workouts: 5,
  total_duration: 230,
  total_calories: 1660,
  this_week_count: 3
};

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? '' : 'light');
  if (!isLight) document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('fittrack_theme', isLight ? 'dark' : 'light');
  document.getElementById('themeToggle').innerHTML = isLight
    ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

function initTheme() {
  if (localStorage.getItem('fittrack_theme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// ─── State ───────────────────────────────────────────────────────────────────
let allWorkouts = [];
let currentFilter = 'all';
let pendingDeleteId = null;
let selectedType = 'Running';

const TYPE_CONFIG = {
  'Running': { icon: '🏃', color: '#ef4444', filter: 'running' },
  'Cycling': { icon: '🚴', color: '#f59e0b', filter: 'cycling' },
  'Yoga': { icon: '🧘', color: '#8b5cf6', filter: 'yoga' },
  'Strength Training': { icon: '💪', color: '#06b6d4', filter: 'strength_training' },
  'Swimming': { icon: '🏊', color: '#0ea5e9', filter: 'swimming' },
  'HIIT': { icon: '⚡', color: '#ec4899', filter: 'hiit' },
  'Walking': { icon: '🚶', color: '#10b981', filter: 'walking' },
  'Pilates': { icon: '🤸', color: '#f97316', filter: 'other' },
  'Boxing': { icon: '🥊', color: '#dc2626', filter: 'other' },
  'Basketball': { icon: '🏀', color: '#d97706', filter: 'other' },
  'Other': { icon: '🏅', color: '#64748b', filter: 'other' }
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG['Other'];
}

// ─── Load data ────────────────────────────────────────────────────────────────
async function loadPage() {
  initTheme();
  const user = getUser();
  const avatar = document.getElementById('userAvatar');
  if (avatar && user.full_name) avatar.textContent = user.full_name.charAt(0).toUpperCase();

  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    if (el.getAttribute('data-page') === 'workouts') el.classList.add('active');
  });

  await Promise.all([loadWorkouts(), loadNotifCount()]);
}

async function loadWorkouts() {
  try {
    if (!getToken()) {
      allWorkouts = DEMO_WORKOUTS;
      renderStats(DEMO_STATS);
      renderWorkouts();
      return;
    }
    const [workouts, stats] = await Promise.all([
      apiCall('/workouts'),
      apiCall('/workouts/stats')
    ]);
    allWorkouts = workouts;
    renderStats(stats);
    renderWorkouts();
  } catch (err) {
    console.error(err);
    allWorkouts = DEMO_WORKOUTS;
    renderStats(DEMO_STATS);
    renderWorkouts();
  }
}

// ─── Render Stats ─────────────────────────────────────────────────────────────
function renderStats(stats) {
  animateNumber('wkTotal', stats.total_workouts || 0);
  animateNumber('wkDuration', stats.total_duration || 0);
  animateNumber('wkCalories', stats.total_calories || 0, 'k', 1000);
  animateNumber('wkThisWeek', stats.this_week_count || 0);
}

function animateNumber(id, target, suffix = '', divisor = 1) {
  const el = document.getElementById(id);
  if (!el) return;
  const finalTarget = target / divisor;
  let start = null;
  const duration = 800;
  function step(ts) {
    if (!start) start = ts;
    const prog = Math.min((ts - start) / duration, 1);
    const val = Math.round(prog * finalTarget);
    el.textContent = divisor === 1000 ? (val >= 1 ? val + suffix : target) : val + suffix;
    if (prog < 1) requestAnimationFrame(step);
    else el.textContent = divisor === 1000 && target >= 1000
      ? (target / 1000).toFixed(1) + 'k'
      : target + suffix;
  }
  requestAnimationFrame(step);
}

// ─── Render Workouts ──────────────────────────────────────────────────────────
function renderWorkouts() {
  const list = document.getElementById('workoutsList');
  const filter = currentFilter.toLowerCase().replace(' ', '_');

  const filtered = currentFilter === 'all'
    ? allWorkouts
    : allWorkouts.filter(w => {
      const cfg = getTypeConfig(w.type);
      return cfg.filter === filter || w.type.toLowerCase().replace(' ', '_') === filter;
    });

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏋️</div>
        <p class="empty-text">No workouts found${currentFilter !== 'all' ? ' for this filter' : ''}.</p>
        <button class="btn btn-primary" onclick="openAddModal()"><i class="fas fa-plus"></i> Log Your First Workout</button>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(w => {
    const cfg = getTypeConfig(w.type);
    const date = new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `
      <div class="workout-card" style="--type-color:${cfg.color}">
        <div class="workout-card-left">
          <div class="workout-type-badge" style="background:${cfg.color}22; color:${cfg.color}; border:1px solid ${cfg.color}44;">
            <span>${cfg.icon}</span>
            <span>${w.type}</span>
          </div>
          <div class="workout-details">
            <div class="workout-meta-row">
              <span class="workout-meta-item"><i class="fas fa-clock"></i> ${w.duration_minutes} min</span>
              <span class="workout-meta-item"><i class="fas fa-fire"></i> ${w.calories_burned} kcal</span>
              <span class="workout-meta-item"><i class="fas fa-calendar"></i> ${date}</span>
            </div>
            ${w.notes ? `<p class="workout-notes">${w.notes}</p>` : ''}
          </div>
        </div>
        <button class="workout-delete-btn" onclick="openDeleteModal(${w.id}, '${w.type}', '${date}')"
                title="Delete workout">
          <i class="fas fa-trash"></i>
        </button>
      </div>`;
  }).join('');
}

// ─── Filters ──────────────────────────────────────────────────────────────────
function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderWorkouts();
}

// ─── Add Workout Modal ────────────────────────────────────────────────────────
function openAddModal() {
  selectedType = 'Running';
  // Reset form
  document.getElementById('durationSlider').value = 30;
  document.getElementById('durationInput').value = 30;
  document.getElementById('workoutCalories').value = '';
  document.getElementById('workoutNotes').value = '';
  document.getElementById('workoutDate').value = new Date().toISOString().split('T')[0];
  // Reset type selection
  document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
  const first = document.querySelector('.type-option[data-type="running"]');
  if (first) first.classList.add('selected');

  document.getElementById('addModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAddModal() {
  document.getElementById('addModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function selectType(type, el) {
  document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  // Convert filter key to proper type name
  const keyMap = {
    'running': 'Running', 'cycling': 'Cycling', 'yoga': 'Yoga',
    'strength_training': 'Strength Training', 'swimming': 'Swimming',
    'hiit': 'HIIT', 'walking': 'Walking', 'pilates': 'Pilates',
    'boxing': 'Boxing', 'basketball': 'Basketball', 'other': 'Other'
  };
  selectedType = keyMap[type] || type;
}

async function submitWorkout(e) {
  e.preventDefault();
  const btn = document.getElementById('addWorkoutBtn');
  const duration = parseInt(document.getElementById('durationInput').value, 10);
  const calories = parseInt(document.getElementById('workoutCalories').value, 10) || 0;
  const notes = document.getElementById('workoutNotes').value.trim();
  const date = document.getElementById('workoutDate').value || new Date().toISOString().split('T')[0];

  if (!duration || duration < 1) { showToast('Please enter a valid duration.', 'error'); return; }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  btn.disabled = true;

  try {
    await apiCall('/workouts', 'POST', {
      type: selectedType,
      duration_minutes: duration,
      calories_burned: calories || estimateCalories(selectedType, duration),
      notes: notes || null,
      date
    });
    closeAddModal();
    showToast(`${selectedType} workout logged! 💪`);
    await loadWorkouts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = '<i class="fas fa-plus"></i> Add Workout';
    btn.disabled = false;
  }
}

function estimateCalories(type, minutes) {
  const rates = {
    'Running': 10, 'Cycling': 8, 'HIIT': 11, 'Swimming': 9,
    'Boxing': 10, 'Basketball': 8, 'Strength Training': 6,
    'Walking': 4, 'Yoga': 3, 'Pilates': 4, 'Other': 5
  };
  return Math.round((rates[type] || 6) * minutes);
}

// ─── Delete Workout ───────────────────────────────────────────────────────────
function openDeleteModal(id, type, date) {
  pendingDeleteId = id;
  document.getElementById('deleteWorkoutInfo').innerHTML =
    `<strong>${type}</strong> &nbsp;·&nbsp; ${date}`;
  document.getElementById('deleteModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.add('hidden');
  document.body.style.overflow = '';
  pendingDeleteId = null;
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
  btn.disabled = true;
  try {
    await apiCall(`/workouts/${pendingDeleteId}`, 'DELETE');
    closeDeleteModal();
    showToast('Workout deleted.');
    await loadWorkouts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    btn.disabled = false;
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function loadNotifCount() {
  try {
    const data = await apiCall('/notifications/unread-count');
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = data.count;
      badge.classList.toggle('hidden', data.count === 0);
    }
  } catch (_) { }
}

function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (isHidden) loadNotifications();
}

async function loadNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;
  try {
    const notifs = await apiCall('/notifications');
    if (!notifs.length) {
      list.innerHTML = '<div class="notif-empty">No notifications</div>';
      return;
    }
    list.innerHTML = notifs.slice(0, 8).map(n => `
      <div class="notif-item ${n.is_read ? '' : 'notif-unread'}" onclick="markRead(${n.id}, this)">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
      </div>`).join('');
  } catch (_) { }
}

async function markRead(id, el) {
  try {
    await apiCall(`/notifications/${id}/read`, 'PUT');
    el.classList.remove('notif-unread');
    await loadNotifCount();
  } catch (_) { }
}

async function markAllRead() {
  try {
    await apiCall('/notifications/mark-all-read', 'POST');
    document.querySelectorAll('.notif-unread').forEach(el => el.classList.remove('notif-unread'));
    const badge = document.getElementById('notifBadge');
    if (badge) { badge.textContent = '0'; badge.classList.add('hidden'); }
  } catch (_) { }
}

// Close notification panel on outside click
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifPanel');
  const bell = document.querySelector('.notification-bell');
  if (panel && !panel.contains(e.target) && !bell?.contains(e.target)) {
    panel.classList.add('hidden');
  }
});

// Close modals on overlay click
document.getElementById('addModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'addModal') closeAddModal();
});
document.getElementById('deleteModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'deleteModal') closeDeleteModal();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadPage();
