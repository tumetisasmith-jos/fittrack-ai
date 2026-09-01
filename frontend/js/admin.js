const _token = localStorage.getItem('fittrack_token');
let _user = null;
try { _user = JSON.parse(localStorage.getItem('fittrack_user')); } catch (e) { }

if (!_token || !_user || _user.role !== 'admin') {
  window.location.href = 'login.html';
}

function logout() {
  localStorage.removeItem('fittrack_token');
  localStorage.removeItem('fittrack_user');
  window.location.href = 'login.html';
}

async function apiCall(endpoint) {
  const res = await fetch('http://localhost:3000/api' + endpoint, {
    headers: { 'Authorization': 'Bearer ' + _token }
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) logout();
    const e = await res.json();
    throw new Error(e.error || 'API Error');
  }
  return res.json();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Chart.js defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
Chart.defaults.font.family = 'Inter';

// State
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let sortKey = 'newest';
const chartInstances = {};

// Navigation helpers
function scrollToUsers() { document.getElementById('usersSection').scrollIntoView({ behavior: 'smooth' }); }
function scrollToAnalytics() { document.getElementById('analyticsSection').scrollIntoView({ behavior: 'smooth' }); }

// Init
document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('userAvatar');
  if (el && _user.name) el.textContent = _user.name.charAt(0).toUpperCase();

  // Attach event listeners for filters
  document.getElementById('roleFilter').addEventListener('change', filterUsers);
  document.getElementById('statusFilter').addEventListener('change', filterUsers);
  document.getElementById('sortFilter').addEventListener('change', filterUsers);

  await Promise.all([loadStats(), loadAnalytics(), loadUsers()]);
});

// KPI stats
async function loadStats() {
  try {
    const data = await apiCall('/admin/stats');
    const stats = data.stats || data;

    animateCount('kpi-users',    stats.total_users    || stats.totalUsers    || 0);
    animateCount('kpi-active',   stats.active_users   || stats.activeUsers   || 0);
    animateCount('kpi-workouts', stats.total_workouts || stats.totalWorkouts || 0);

    const avgBmi = stats.avg_bmi ?? stats.avgBmi ?? 0;
    document.getElementById('kpi-bmi').textContent = avgBmi > 0 ? (+avgBmi).toFixed(1) : '0';
    const avgSteps = stats.avg_daily_steps ?? stats.avgDailySteps ?? 0;
    document.getElementById('kpi-steps').textContent = avgSteps !== null ? Math.round(+avgSteps).toLocaleString() : '0';
    const goalRate = stats.goal_completion_rate ?? stats.goalCompletionRate ?? 0;
    document.getElementById('kpi-goals').textContent = goalRate !== null ? Math.round(+goalRate) + '%' : '0%';
  } catch (err) {
    console.error('Stats error:', err);
    showFallbackKpis();
  }
}

function showFallbackKpis() {
  ['kpi-users','kpi-active','kpi-workouts','kpi-bmi','kpi-steps','kpi-goals'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.textContent === '—') el.textContent = 'N/A';
  });
}

function animateCount(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  const duration = 1200;
  const start = Date.now();
  const step = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Analytics charts
async function loadAnalytics() {
  try {
    const data = await apiCall('/admin/analytics');
    const analytics = data.analytics || data;

    buildGrowthChart(analytics.user_growth || analytics.userGrowth || []);
    buildWorkoutDonutChart(analytics.workout_distribution || analytics.workoutDistribution || {});
  } catch (err) {
    console.error('Analytics error:', err);
    buildGrowthChart([]);
    buildWorkoutDonutChart({});
  }
}


function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildGrowthChart(growthData) {
  if (chartInstances.growth) { chartInstances.growth.destroy(); }
  const ctx = document.getElementById('growthChart').getContext('2d');

  const labels = growthData.map(d => shortDate(d.date || d.day));
  const values = growthData.map(d => +(d.count || d.new_users || 0));

  const cumulative = [];
  let sum = 0;
  values.forEach(v => { sum += v; cumulative.push(sum); });

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(6,182,212,0.4)');
  gradient.addColorStop(1, 'rgba(6,182,212,0.02)');

  chartInstances.growth = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'New Users',
        data: values,
        borderColor: '#06b6d4',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } }, beginAtZero: true }
      },
      animation: { duration: 800 }
    }
  });
}

function buildWorkoutDonutChart(distribution) {
  if (chartInstances.donut) { chartInstances.donut.destroy(); }
  const ctx = document.getElementById('workoutDonutChart').getContext('2d');

  let labels = [];
  let values = [];

  if (Array.isArray(distribution) && distribution.length > 0) {
    labels = distribution.map(d => d.type || 'Unknown');
    values = distribution.map(d => +(d.count || 0));
  } else if (distribution && !Array.isArray(distribution) && Object.keys(distribution).length > 0) {
    labels = Object.keys(distribution);
    values = Object.values(distribution);
  }

  const hasData = labels.length > 0;
  if (!hasData) {
    labels = ['No data yet'];
    values = [1];
  }

  const COLORS = ['#c4f135','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6'];

  chartInstances.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: hasData ? COLORS.slice(0, labels.length) : ['rgba(255,255,255,0.08)'],
        borderColor: '#0a0a0a',
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, font: { size: 11 }, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} workouts (${Math.round((ctx.parsed / values.reduce((a,b)=>a+b,0))*100)}%)`
          }
        }
      },
      animation: { animateRotate: true, duration: 800 }
    }
  });
}

// Users table
async function loadUsers() {
  try {
    const data = await apiCall('/admin/users');
    let users = Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
    
    allUsers = users
      .filter(u => u.role !== 'admin') // Exclude admin users
      .map(u => ({
      ...u,
      mockStatus: (+(u.workout_count || 0) > 0) ? 'active' : 'inactive'
    }));

    filterUsers();
  } catch (err) {
    console.error('Users error:', err);
    document.getElementById('usersTableBody').innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:32px;color:var(--accent-red)">
        <i class="fas fa-exclamation-circle"></i> Failed to load users: ${err.message}
      </td></tr>`;
  }
}

function filterUsers() {
  const query = document.getElementById('userSearch').value.toLowerCase().trim();
  const roleFilter = document.getElementById('roleFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;
  const sortOption = document.getElementById('sortFilter').value;
  sortKey = sortOption;

  filteredUsers = allUsers.filter(u => {
    const nameMatch = (u.full_name || u.name || '').toLowerCase().includes(query);
    const matchesSearch = nameMatch || (u.email || '').toLowerCase().includes(query);
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    const matchesStatus = statusFilter ? u.mockStatus === statusFilter : true;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Sort logic for dropdown
  filteredUsers.sort((a, b) => {
    const tA = new Date(a.created_at || 0).getTime();
    const tB = new Date(b.created_at || 0).getTime();
    if (sortKey === 'newest') return tB - tA;
    if (sortKey === 'oldest') return tA - tB;
    return 0;
  });

  currentPage = 1;
  renderTable();
}

function sortUsers(key) {
  // Sort via clicking headers (not via dropdown)
  filteredUsers.sort((a, b) => {
    let va, vb;
    if (key === 'name') { va = (a.full_name || a.name || '').toLowerCase(); vb = (b.full_name || b.name || '').toLowerCase(); }
    else if (key === 'age') { va = +(a.age || 0); vb = +(b.age || 0); }
    else if (key === 'bmi') { va = computeBmi(a); vb = computeBmi(b); }
    else if (key === 'workouts') { va = +(a.workout_count || a.workoutCount || 0); vb = +(b.workout_count || b.workoutCount || 0); }
    else { va = 0; vb = 0; }
    
    // Simple toggle logic could go here, defaulting to desc
    if (va < vb) return 1;
    if (va > vb) return -1;
    return 0;
  });

  renderTable();
}

function computeBmi(u) {
  const w = +(u.weight_kg || 0);
  const h = +(u.height_cm || 0);
  if (!w || !h) return 0;
  return w / ((h / 100) ** 2);
}

function bmiChip(u) {
  const bmi = computeBmi(u);
  if (!bmi) return '—';
  const val = bmi.toFixed(1);
  if (bmi < 18.5) return `<span class="bmi-chip bmi-under">${val}</span>`;
  if (bmi < 25) return `<span class="bmi-chip bmi-normal">${val}</span>`;
  if (bmi < 30) return `<span class="bmi-chip bmi-over">${val}</span>`;
  return `<span class="bmi-chip bmi-obese">${val}</span>`;
}

function renderTable() {
  const body = document.getElementById('usersTableBody');
  const total = filteredUsers.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageUsers = filteredUsers.slice(start, end);

  if (!pageUsers.length) {
    body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-users-slash" style="font-size:24px;display:block;margin-bottom:8px"></i>No users found</td></tr>`;
    document.getElementById('pageInfo').textContent = 'No results';
    document.getElementById('pageBtns').innerHTML = '';
    return;
  }

  body.innerHTML = pageUsers.map(u => {
    const isAdmin = u.role === 'admin';
    const nameStr = u.full_name || u.name || 'Unknown';
    const initials = nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const workoutCount = +(u.workout_count || u.workoutCount || 0);
    const statusIcon = u.mockStatus === 'active' ? '<i class="fas fa-check-circle"></i> Active' : '<i class="fas fa-moon"></i> Inactive';
    const statusClass = u.mockStatus === 'active' ? 'status-active' : 'status-inactive';

    return `
      <tr class="${isAdmin ? 'admin-row' : ''}">
        <td>
          <div class="user-cell">
            <div class="user-avatar-sm">${initials}</div>
            <div>
              <div class="user-name">${nameStr}</div>
              <div class="user-email">${u.email || '—'}</div>
            </div>
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${statusIcon}</span></td>
        <td>${u.age || '—'}</td>
        <td>${bmiChip(u)}</td>
        <td style="font-weight:600;color:var(--text-primary)">${workoutCount.toLocaleString()}</td>
        <td>${+(u.goal_count || 0)}</td>
<td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : `�`}</td>
        <td>
          <span class="role-badge ${isAdmin ? 'role-admin' : 'role-user'}">
            <i class="fas fa-${isAdmin ? 'shield-alt' : 'user'}"></i>
            ${isAdmin ? 'Admin' : 'User'}
          </span>
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="View" onclick="viewUser(${JSON.stringify(u).replace(/"/g, '&quot;')})"><i class="fas fa-eye"></i></button>
            <button class="btn-icon edit" title="Edit"><i class="fas fa-pen"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('pageInfo').textContent = `Showing ${start + 1}—${end} of ${total} users`;

  const pageBtns = document.getElementById('pageBtns');
  const pages = [];
  if (currentPage > 1) pages.push(`<button class="page-btn" onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`);

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  for (let p = startPage; p <= endPage; p++) {
    pages.push(`<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`);
  }

  if (currentPage < totalPages) pages.push(`<button class="page-btn" onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`);
  pageBtns.innerHTML = pages.join('');
}

function goToPage(page) {
  currentPage = page;
  renderTable();
  document.getElementById('usersSection').scrollIntoView({ behavior: 'smooth' });
}

// ─── View User Modal ──────────────────────────────────────────────────────────
function viewUser(u) {
  const nameStr = u.full_name || u.name || 'Unknown';
  const initials = nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('modalAvatar').textContent = initials;
  document.getElementById('modalName').textContent = nameStr;
  document.getElementById('modalEmail').textContent = u.email || '—';

  const bmi = computeBmi(u);
  const fields = [
    { label: 'Age',      value: u.age ? u.age + ' yrs' : '—' },
    { label: 'Gender',   value: u.gender ? u.gender.charAt(0).toUpperCase() + u.gender.slice(1) : '—' },
    { label: 'Height',   value: u.height_cm ? u.height_cm + ' cm' : '—' },
    { label: 'Weight',   value: u.weight_kg ? u.weight_kg + ' kg' : '—' },
    { label: 'BMI',      value: bmi ? bmi.toFixed(1) : '—' },
    { label: 'Workouts', value: (+(u.workout_count || 0)).toString() },
    { label: 'Status',   value: u.mockStatus === 'active' ? '🟢 Active' : '🌙 Inactive' },
    { label: 'Role',     value: u.role === 'admin' ? '🛡 Admin' : '👤 User' },
  ];

  document.getElementById('modalGrid').innerHTML = fields.map(f => `
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:8px;padding:10px 12px;">
      <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px;">${f.label}</div>
      <div style="font-size:14px;color:var(--text-primary);font-weight:600;">${f.value}</div>
    </div>
  `).join('');

  const modal = document.getElementById('userModal');
  modal.style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('userModal').style.display = 'none';
}

// Close modal on backdrop click
document.getElementById('userModal').addEventListener('click', function(e) {
  if (e.target === this) closeUserModal();
});

// ─── Broadcast Announcement ───────────────────────────────────────────────────
function sendAnnouncement() {
  const msg = document.getElementById('announcementMsg')?.value?.trim();
  if (!msg) { toast('Please write an announcement first.', 'error'); return; }

  // Store in localStorage as a simple admin broadcast (no backend endpoint needed for demo)
  const announcements = JSON.parse(localStorage.getItem('fittrack_announcements') || '[]');
  announcements.unshift({ message: msg, date: new Date().toISOString(), from: 'Admin' });
  localStorage.setItem('fittrack_announcements', JSON.stringify(announcements.slice(0, 10)));
  document.getElementById('announcementMsg').value = '';
  toast('Announcement broadcast to all users!', 'success');
}

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${type==='success'?'var(--green)':'var(--accent-red)'};color:#000;padding:12px 20px;border-radius:10px;font-weight:600;font-size:13px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.4);transition:all 0.3s;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}


