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

// ── Goal type configurations ─────────────────────────────────────────────────
const GOAL_TYPES = {
  daily_steps:    { unit: 'steps',    icon: '👟', color: 'var(--accent-cyan)',   label: 'Daily Steps' },
  water_intake:   { unit: 'ml',       icon: '💧', color: '#3b82f6',              label: 'Water Intake' },
  weight_loss:    { unit: 'kg',       icon: '⚖️', color: 'var(--accent-green)',  label: 'Weight Loss' },
  workout_count:  { unit: 'workouts', icon: '💪', color: 'var(--accent-purple)', label: 'Workout Count' },
  sleep_hours:    { unit: 'hours',    icon: '😴', color: '#6366f1',              label: 'Sleep Hours' },
  calories_burned:{ unit: 'kcal',     icon: '🔥', color: 'var(--accent-orange)', label: 'Calories Burned' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let allGoals = [];
let completedOpen = false;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  const el = document.getElementById('userAvatar');
  if (el && user.name) el.textContent = user.name.charAt(0).toUpperCase();

  // Set min deadline to tomorrow
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('goalDeadline').min = tomorrow.toISOString().slice(0, 10);

  loadGoals();
});

// ── Load goals ────────────────────────────────────────────────────────────────
async function loadGoals() {
  try {
    const data = await apiCall('/goals');
    allGoals = Array.isArray(data.goals) ? data.goals : (Array.isArray(data) ? data : []);
    renderGoals();
  } catch (err) {
    showToast('Failed to load goals: ' + err.message, 'error');
    document.getElementById('activeGoalsGrid').innerHTML = `<div style="color:var(--accent-red);padding:20px"><i class="fas fa-exclamation-circle"></i> Error loading goals</div>`;
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderGoals() {
  const active = allGoals.filter(g => g.status !== 'completed');
  const completed = allGoals.filter(g => g.status === 'completed');

  document.getElementById('activeCount').textContent = active.length;
  document.getElementById('completedCount').textContent = completed.length;
  document.getElementById('totalCount').textContent = allGoals.length;

  renderActiveGoals(active);
  renderCompletedGoals(completed);
}

function renderActiveGoals(goals) {
  const grid = document.getElementById('activeGoalsGrid');
  if (!goals.length) {
    grid.innerHTML = `
      <div class="empty-goals" style="grid-column:1/-1">
        <i class="fas fa-bullseye"></i>
        <h3>No active goals yet</h3>
        <p>Set a goal to start tracking your progress</p>
      </div>`;
    return;
  }
  grid.innerHTML = goals.map(goal => goalCard(goal, false)).join('');

  // Animate progress bars after render
  requestAnimationFrame(() => {
    document.querySelectorAll('.progress-fill[data-pct]').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  });
}

function renderCompletedGoals(goals) {
  const grid = document.getElementById('completedGoalsGrid');
  if (!goals.length) {
    grid.innerHTML = `<div style="padding:20px;color:var(--text-muted)">No completed goals yet.</div>`;
    return;
  }
  grid.innerHTML = goals.map(goal => goalCard(goal, true)).join('');
}

function goalCard(goal, isCompleted) {
  const type = GOAL_TYPES[goal.goal_type] || { unit: '', icon: '🎯', color: 'var(--accent-purple)', label: goal.goal_type };
  const current = +(goal.current_value || 0);
  const target = +(goal.target_value || 1);
  const pct = Math.min(100, Math.round((current / target) * 100));
  const deadlineDays = daysUntil(goal.deadline);
  const deadlineClass = deadlineDays <= 3 ? 'urgent' : deadlineDays <= 7 ? 'ok' : '';
  const deadlineText = deadlineDays < 0 ? 'Overdue' : deadlineDays === 0 ? 'Due today' : `${deadlineDays}d left`;

  return `
    <div class="goal-card ${isCompleted ? 'completed-card' : ''}" style="--goal-color:${type.color}">
      <div class="goal-header">
        <div class="goal-icon-type">
          <span class="goal-emoji">${type.icon}</span>
          <div>
            <div class="goal-name">${type.label}</div>
            ${goal.description ? `<div class="goal-desc">${goal.description}</div>` : ''}
          </div>
        </div>
        ${!isCompleted ? `
          <div class="goal-actions-top">
            <button class="btn-icon" onclick="deleteGoal(${goal.id})" title="Delete goal"><i class="fas fa-trash"></i></button>
          </div>` : ''}
      </div>

      <div class="goal-values">
        <div>
          <div class="goal-current">${current.toLocaleString()} <span>${type.unit}</span></div>
        </div>
        <div class="goal-target-text">
          Target: <strong>${target.toLocaleString()} ${type.unit}</strong>
        </div>
      </div>

      <div class="progress-track">
        <div class="progress-fill" data-pct="${pct}" style="width:0%;background:${type.color}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="progress-pct" style="color:${type.color}">${pct}% complete</div>
        ${!isCompleted ? `<div class="goal-deadline ${deadlineClass}"><i class="fas fa-clock"></i> ${deadlineText}</div>` : ''}
      </div>

      ${isCompleted ? `<div class="completed-badge"><i class="fas fa-check"></i> Completed</div>` : `
        <div class="update-row">
          <input type="number" class="update-input" id="upd-${goal.id}" placeholder="Update current value" min="0" style="--goal-color:${type.color}">
          <button class="btn-update" onclick="updateGoal(${goal.id})" style="background:${type.color}">Update</button>
        </div>`}
    </div>`;
}

function daysUntil(dateStr) {
  if (!dateStr) return 999;
  const deadline = new Date(dateStr + 'T23:59:59');
  const now = new Date();
  return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
}

// ── Completed toggle ──────────────────────────────────────────────────────────
function toggleCompleted() {
  completedOpen = !completedOpen;
  document.getElementById('completedSection').classList.toggle('open', completedOpen);
  document.getElementById('toggleArrow').classList.toggle('open', completedOpen);
}

// ── Create goal modal ─────────────────────────────────────────────────────────
function openCreateModal() {
  document.getElementById('createModal').classList.add('open');
  document.getElementById('createGoalForm').reset();
  document.getElementById('typePreview').style.display = 'none';
}

function closeCreateModal() {
  document.getElementById('createModal').classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('createModal')) closeCreateModal();
}

function onTypeChange() {
  const type = document.getElementById('goalType').value;
  const preview = document.getElementById('typePreview');
  if (type && GOAL_TYPES[type]) {
    const cfg = GOAL_TYPES[type];
    document.getElementById('previewEmoji').textContent = cfg.icon;
    document.getElementById('previewUnit').textContent = cfg.unit;
    preview.style.display = 'flex';
  } else {
    preview.style.display = 'none';
  }
}

async function submitGoal(e) {
  e.preventDefault();
  const btn = document.getElementById('goalSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';

  try {
    const payload = {
      goal_type: document.getElementById('goalType').value,
      target_value: parseFloat(document.getElementById('targetValue').value),
      current_value: parseFloat(document.getElementById('currentValue').value) || 0,
      deadline: document.getElementById('goalDeadline').value,
      description: document.getElementById('goalDesc').value || null,
    };

    await apiCall('/goals', 'POST', payload);
    showToast('Goal created! 🎯', 'success');
    closeCreateModal();
    await loadGoals();
  } catch (err) {
    showToast('Failed to create goal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-bullseye"></i> Create Goal';
  }
}

// ── Update goal ───────────────────────────────────────────────────────────────
async function updateGoal(id) {
  const input = document.getElementById(`upd-${id}`);
  const newValue = parseFloat(input.value);
  if (isNaN(newValue) || newValue < 0) {
    showToast('Please enter a valid value', 'error');
    return;
  }

  try {
    const goal = allGoals.find(g => g.id === id);
    const payload = { current_value: newValue };

    // Auto-complete if current >= target
    if (goal && newValue >= +(goal.target_value)) {
      payload.status = 'completed';
    }

    await apiCall(`/goals/${id}`, 'PUT', payload);

    if (payload.status === 'completed') {
      showToast('🎉 Goal achieved! Congratulations!', 'success');
    } else {
      showToast('Progress updated!', 'success');
    }
    input.value = '';
    await loadGoals();
  } catch (err) {
    showToast('Failed to update: ' + err.message, 'error');
  }
}

// ── Delete goal ───────────────────────────────────────────────────────────────
async function deleteGoal(id) {
  if (!confirm('Delete this goal? This action cannot be undone.')) return;
  try {
    await apiCall(`/goals/${id}`, 'DELETE');
    showToast('Goal deleted', 'info');
    await loadGoals();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}
