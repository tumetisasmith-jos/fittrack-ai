/* =====================================================
   FitTrack AI — profile.js
   Profile page: user data, BMI gauge, edit modal,
   BMI history, achievements, workout stats
   ===================================================== */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `http://localhost:${window.location.port || 4000}/api`
  : 'https://fittrack-ai.onrender.com/api';

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

/* toggleSidebar provided by sidebar.js */

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

/* ============ Notifications ============ */
function toggleNotifications() {
  document.getElementById('notifPanel').classList.toggle('hidden');
}
async function markAllRead() {
  try { await apiCall('/notifications/mark-read', 'PUT'); } catch { /* ignore */ }
}

/* ============ Utility ============ */
function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function capitalize(str) {
  if (!str) return '';
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ============ BMI Gauge (SVG) ============ */
let currentBMI = 0;
let needleAnimationId = null;

function polarToCart(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 180) * Math.PI / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const s = polarToCart(cx, cy, r, startAngle);
  const e = polarToCart(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

// Map BMI value (10-40) to angle (0-180 degrees) on the semicircle
function bmiToAngle(bmi) {
  const minBMI = 10, maxBMI = 40;
  const clamped = Math.max(minBMI, Math.min(maxBMI, bmi));
  return ((clamped - minBMI) / (maxBMI - minBMI)) * 180;
}

function getBMICategoryColor(bmi) {
  if (bmi < 18.5) return '#3b82f6';
  if (bmi < 25) return '#10b981';
  if (bmi < 30) return '#f59e0b';
  return '#ef4444';
}

function getBMICategory(bmi) {
  if (!bmi) return 'N/A';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal Weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function drawBMIGauge(bmi) {
  const svg = document.getElementById('bmiGauge');
  svg.innerHTML = '';

  const cx = 150, cy = 155, r = 110;
  const trackR = r;
  const strokeW = 18;

  // Background track
  const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  bgPath.setAttribute('d', describeArc(cx, cy, trackR, 0, 180));
  bgPath.setAttribute('fill', 'none');
  bgPath.setAttribute('stroke', 'rgba(255,255,255,0.06)');
  bgPath.setAttribute('stroke-width', strokeW);
  bgPath.setAttribute('stroke-linecap', 'round');
  svg.appendChild(bgPath);

  // Zone arcs
  const zones = [
    { start: 0,   end: 51,  color: '#3b82f6', label: '<18.5' },  // underweight: 10–18.5
    { start: 51,  end: 102, color: '#10b981', label: '18.5–24.9' }, // normal: 18.5–25
    { start: 102, end: 137, color: '#f59e0b', label: '25–29.9' }, // overweight: 25–30
    { start: 137, end: 180, color: '#ef4444', label: '≥30' }      // obese: 30–40
  ];

  zones.forEach(z => {
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arc.setAttribute('d', describeArc(cx, cy, trackR, z.start, z.end));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', z.color);
    arc.setAttribute('stroke-width', strokeW);
    arc.setAttribute('stroke-linecap', 'butt');
    arc.setAttribute('opacity', '0.85');
    svg.appendChild(arc);
  });

  // Tick marks
  [0, 51, 102, 137, 180].forEach((ang, i) => {
    const inner = polarToCart(cx, cy, trackR - strokeW / 2 - 2, ang);
    const outer = polarToCart(cx, cy, trackR + strokeW / 2 + 4, ang);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', inner.x); tick.setAttribute('y1', inner.y);
    tick.setAttribute('x2', outer.x); tick.setAttribute('y2', outer.y);
    tick.setAttribute('stroke', 'rgba(255,255,255,0.25)');
    tick.setAttribute('stroke-width', '2');
    svg.appendChild(tick);

    // Labels
    const labels = ['10', '18.5', '25', '30', '40'];
    const lPos = polarToCart(cx, cy, trackR + strokeW / 2 + 16, ang);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', lPos.x);
    text.setAttribute('y', lPos.y + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '9');
    text.setAttribute('fill', 'rgba(255,255,255,0.45)');
    text.setAttribute('font-family', 'Inter, sans-serif');
    text.textContent = labels[i];
    svg.appendChild(text);
  });

  // Needle group — animate from 0 to target
  const needleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  needleGroup.setAttribute('id', 'bmiNeedle');

  const pivotR = 8;
  const needleLen = trackR - strokeW / 2 - 6;

  // Draw needle at angle 0 first, animate to target
  const targetAngle = bmi ? bmiToAngle(bmi) : 0;
  let currentAngle = 0;

  function drawNeedleAt(angleDeg) {
    needleGroup.innerHTML = '';

    const tip = polarToCart(cx, cy, needleLen, angleDeg);

    // Needle body
    const needle = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    needle.setAttribute('x1', cx); needle.setAttribute('y1', cy);
    needle.setAttribute('x2', tip.x); needle.setAttribute('y2', tip.y);
    needle.setAttribute('stroke', '#f8fafc');
    needle.setAttribute('stroke-width', '3');
    needle.setAttribute('stroke-linecap', 'round');
    needleGroup.appendChild(needle);

    // Shadow line
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    shadow.setAttribute('x1', cx); shadow.setAttribute('y1', cy);
    shadow.setAttribute('x2', tip.x); shadow.setAttribute('y2', tip.y);
    shadow.setAttribute('stroke', 'rgba(255,255,255,0.15)');
    shadow.setAttribute('stroke-width', '6');
    shadow.setAttribute('stroke-linecap', 'round');
    needleGroup.insertBefore(shadow, needle);

    // Pivot circle
    const pivot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pivot.setAttribute('cx', cx); pivot.setAttribute('cy', cy);
    pivot.setAttribute('r', pivotR);
    pivot.setAttribute('fill', '#f8fafc');
    needleGroup.appendChild(pivot);

    const pivotInner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pivotInner.setAttribute('cx', cx); pivotInner.setAttribute('cy', cy);
    pivotInner.setAttribute('r', pivotR - 3);
    pivotInner.setAttribute('fill', bmi ? getBMICategoryColor(bmi) : '#64748b');
    needleGroup.appendChild(pivotInner);
  }

  drawNeedleAt(0);
  svg.appendChild(needleGroup);

  // Animate needle
  if (needleAnimationId) cancelAnimationFrame(needleAnimationId);
  const startTime = performance.now();
  const duration = 1200;

  function animateNeedle(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const angle = currentAngle + (targetAngle - currentAngle) * eased;
    drawNeedleAt(angle);
    if (t < 1) {
      needleAnimationId = requestAnimationFrame(animateNeedle);
    }
  }

  if (bmi) {
    needleAnimationId = requestAnimationFrame(animateNeedle);
  }
}

/* ============ Render Profile Hero ============ */
function renderProfileHero(profile) {
  const name = profile.full_name || profile.username || 'User';
  document.getElementById('profileAvatarLarge').textContent = getInitials(name);
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileUsername').textContent = `@${profile.username || 'user'}`;

  const level = profile.level || 'Bronze';
  const xp = profile.xp_points || profile.xp || 0;
  const xpForNext = 500;
  const xpInLevel = xp % xpForNext;
  const xpPct = Math.min((xpInLevel / xpForNext) * 100, 100);

  document.getElementById('profileLevelText').textContent = `${typeof level === 'number' ? 'Level ' + level : level} • ${xp} XP`;
  document.getElementById('profileXpText').textContent = `${xpInLevel.toLocaleString()} / ${xpForNext.toLocaleString()} XP`;

  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) avatarEl.textContent = getInitials(name);

  setTimeout(() => {
    document.getElementById('profileXpBar').style.width = xpPct + '%';
  }, 200);
}

/* ============ Render Personal Stats ============ */
function renderPersonalStats(profile) {
  document.getElementById('pAge').textContent = profile.age ? `${profile.age} yr` : '—';
  document.getElementById('pGender').textContent = profile.gender ? capitalize(profile.gender) : '—';
  document.getElementById('pHeight').textContent = profile.height_cm ? `${profile.height_cm}` : '—';
  document.getElementById('pWeight').textContent = profile.weight_kg ? `${profile.weight_kg}` : '—';
}

/* ============ Render BMI ============ */
function renderBMI(profile) {
  let bmi = null;
  if (profile.weight_kg && profile.height_cm) {
    const hm = profile.height_cm / 100;
    bmi = profile.weight_kg / (hm * hm);
    bmi = Math.round(bmi * 10) / 10;
    currentBMI = bmi;
  }

  const bmiEl = document.getElementById('bmiValueDisplay');
  const catEl = document.getElementById('bmiCategoryDisplay');

  if (bmi) {
    bmiEl.textContent = bmi.toFixed(1);
    const cat = getBMICategory(bmi);
    const color = getBMICategoryColor(bmi);
    catEl.textContent = cat;
    catEl.style.color = color;
    drawBMIGauge(bmi);
  } else {
    bmiEl.textContent = 'N/A';
    catEl.textContent = 'Set height & weight in profile to see BMI';
    catEl.style.color = 'var(--text-muted)';
    drawBMIGauge(null);
  }
}

/* ============ BMI History ============ */
async function loadBMIHistory() {
  const container = document.getElementById('bmiHistoryList');
  try {
    const data = await apiCall('/bmi');
    const history = Array.isArray(data) ? data : (data.history || data.records || []);

    if (!history.length) {
      // Show placeholder with current BMI as the first entry
      if (currentBMI) {
        container.innerHTML = `
          <div class="bmi-history-item">
            <div class="bmi-hist-dot" style="background:${getBMICategoryColor(currentBMI)};"></div>
            <div class="bmi-hist-info">
              <div class="bmi-hist-val">BMI: ${currentBMI.toFixed(1)}</div>
              <div class="bmi-hist-date">Today</div>
            </div>
            <div class="bmi-hist-change" style="color:var(--accent-green);">Current</div>
          </div>
          <div class="empty-state" style="padding:16px;"><i class="fas fa-history" style="font-size:1.5rem;opacity:0.3;"></i><br>More history will appear<br>as you update your profile.</div>
        `;
      } else {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-history"></i><br>No BMI history yet.<br>Update your weight to track BMI over time.</div>`;
      }
      return;
    }

    container.innerHTML = history.slice(0, 5).map((entry, idx) => {
      const bmiVal = parseFloat(entry.bmi || entry.bmi_value);
      const color = getBMICategoryColor(bmiVal);
      const prev = history[idx + 1];
      let changeHtml = '';
      if (prev) {
        const prevBMI = parseFloat(prev.bmi || prev.bmi_value);
        const diff = bmiVal - prevBMI;
        if (Math.abs(diff) >= 0.1) {
          const sign = diff > 0 ? '+' : '';
          const col = diff > 0 ? '#ef4444' : '#10b981';
          changeHtml = `<div class="bmi-hist-change" style="color:${col};">${sign}${diff.toFixed(1)}</div>`;
        }
      }
      return `
        <div class="bmi-history-item">
          <div class="bmi-hist-dot" style="background:${color};"></div>
          <div class="bmi-hist-info">
            <div class="bmi-hist-val">BMI: ${bmiVal.toFixed(1)} — ${getBMICategory(bmiVal)}</div>
            <div class="bmi-hist-date">${formatDate(entry.recorded_at || entry.date || entry.createdAt)}</div>
          </div>
          ${changeHtml}
        </div>`;
    }).join('');
  } catch {
    // BMI history not available
    container.innerHTML = currentBMI
      ? `<div class="bmi-history-item">
           <div class="bmi-hist-dot" style="background:${getBMICategoryColor(currentBMI)};"></div>
           <div class="bmi-hist-info">
             <div class="bmi-hist-val">BMI: ${currentBMI.toFixed(1)} — ${getBMICategory(currentBMI)}</div>
             <div class="bmi-hist-date">Current</div>
           </div>
         </div>
         <div style="padding:12px;font-size:0.8rem;color:var(--text-muted);text-align:center;">Update your profile regularly to track BMI changes over time.</div>`
      : `<div class="empty-state"><i class="fas fa-history"></i><br>Set height & weight to see BMI history.</div>`;
  }
}

/* ============ Achievements ============ */
async function loadAchievements() {
  const container = document.getElementById('achievementsGallery');
  try {
    const data = await apiCall('/achievements');
    const achievements = data.achievements || data || [];

    document.getElementById('achievementCount').textContent =
      achievements.length ? `${achievements.length} earned` : '';

    if (!achievements.length) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <i class="fas fa-medal"></i>
        Complete workouts, log activities, and reach goals to earn badges!
      </div>`;
      return;
    }

    container.innerHTML = achievements.map(a => `
      <div class="achievement-tile">
        <span class="ach-icon">${a.icon || '🏅'}</span>
        <div class="ach-name">${a.name || a.title || 'Achievement'}</div>
        <div class="ach-desc">${a.description || ''}</div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-medal"></i><br>Achievements could not be loaded.</div>`;
  }
}

/* ============ Profile Stats Summary ============ */
async function loadProfileStats() {
  try {
    const [wkRes, logsRes, goalsRes] = await Promise.allSettled([
      apiCall('/workouts?limit=1000'),
      apiCall('/daily-logs?limit=1000'),
      apiCall('/goals')
    ]);

    if (wkRes.status === 'fulfilled') {
      const wk = wkRes.value.workouts || wkRes.value || [];
      document.getElementById('totalWorkouts').textContent = wk.length;
    } else {
      document.getElementById('totalWorkouts').textContent = '—';
    }

    if (logsRes.status === 'fulfilled') {
      const logs = logsRes.value.logs || logsRes.value || [];
      document.getElementById('totalDaysLogged').textContent = logs.length;
    } else {
      document.getElementById('totalDaysLogged').textContent = '—';
    }

    if (goalsRes.status === 'fulfilled') {
      const goals = goalsRes.value.goals || goalsRes.value || [];
      const completed = goals.filter(g => g.status === 'completed').length;
      document.getElementById('totalGoalsCompleted').textContent = completed;
    } else {
      document.getElementById('totalGoalsCompleted').textContent = '—';
    }
  } catch { /* fail silently */ }
}

/* ============ Edit Profile Modal ============ */
let currentProfile = {};

function openEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('open'));

  // Pre-fill form
  document.getElementById('editName').value = currentProfile.full_name || '';
  document.getElementById('editAge').value = currentProfile.age || '';
  document.getElementById('editGender').value = currentProfile.gender || '';
  document.getElementById('editHeight').value = currentProfile.height_cm || '';
  document.getElementById('editWeight').value = currentProfile.weight_kg || '';
  document.getElementById('editFitnessGoal').value = currentProfile.fitness_goal || '';
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.remove('open');
  setTimeout(() => modal.classList.add('hidden'), 250);
}

// Close on backdrop click
document.getElementById('editModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('editModal')) closeEditModal();
});

async function saveProfile(e) {
  e.preventDefault();
  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const payload = {
    full_name: document.getElementById('editName').value.trim(),
    age: parseInt(document.getElementById('editAge').value) || null,
    gender: document.getElementById('editGender').value || null,
    height_cm: parseFloat(document.getElementById('editHeight').value) || null,
    weight_kg: parseFloat(document.getElementById('editWeight').value) || null,
    fitness_goal: document.getElementById('editFitnessGoal').value || null
  };

  try {
    const updated = await apiCall('/users/me', 'PUT', payload);
    currentProfile = { ...currentProfile, ...updated, ...(updated.user || {}) };
    // Update stored user
    const stored = getUser();
    localStorage.setItem('fittrack_user', JSON.stringify({ ...stored, ...currentProfile }));

    renderProfileHero(currentProfile);
    renderPersonalStats(currentProfile);
    renderBMI(currentProfile);
    await loadBMIHistory();

    showToast('Profile updated successfully! ✨');
    closeEditModal();
  } catch (err) {
    showToast(err.message || 'Failed to update profile', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
  }
}

/* ============ Main Load ============ */
function buildProfileFromCache() {
  const cached = getUser();
  if (!cached.full_name && !cached.username) return null;
  return {
    full_name: cached.full_name || cached.username,
    username: cached.username || 'user',
    level: cached.level || 'Bronze',
    xp_points: cached.xp_points || cached.xp || 0,
    age: cached.age,
    gender: cached.gender,
    height_cm: cached.height_cm,
    weight_kg: cached.weight_kg,
    email: cached.email
  };
}

async function loadProfilePage() {
  const token = getToken();
  const cachedProfile = buildProfileFromCache();

  if (!token && !cachedProfile) {
    cachedProfile = {
      full_name: 'Demo User',
      username: 'demouser',
      level: 'Bronze',
      xp_points: 150,
      age: 28,
      gender: 'other',
      height_cm: 175,
      weight_kg: 70,
      email: 'demo@fittrack.ai'
    };
  }

  try {
    let profile;
    if (token) {
      profile = await apiCall('/users/me');
      currentProfile = profile;
      localStorage.setItem('fittrack_user', JSON.stringify(profile));
    } else {
      profile = cachedProfile;
      currentProfile = profile;
    }

    renderProfileHero(profile);
    renderPersonalStats(profile);
    renderBMI(profile);

    await Promise.all([
      token ? loadBMIHistory() : Promise.resolve(),
      token ? loadAchievements() : Promise.resolve(),
      token ? loadProfileStats() : Promise.resolve()
    ]);

    if (token) {
      try {
        const notifData = await apiCall('/notifications?limit=5');
        const notifs = notifData.notifications || notifData || [];
        const unread = notifs.filter(n => !n.isRead && !n.is_read).length;
        if (unread > 0) {
          const badge = document.getElementById('notifBadge');
          badge.textContent = unread > 9 ? '9+' : unread;
          badge.classList.remove('hidden');
        }
      } catch { /* ignore */ }
    }

  } catch (err) {
    console.error('Profile load error:', err);
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('401') || msg.includes('403') || msg.includes('token') || msg.includes('unauthorized')) {
      if (cachedProfile) {
        currentProfile = cachedProfile;
        renderProfileHero(cachedProfile);
        renderPersonalStats(cachedProfile);
        renderBMI(cachedProfile);
        showToast('Showing cached profile — please log in again to refresh', 'info');
      } else {
        showToast('Authentication error, showing demo data', 'warning');
        currentProfile = { full_name: 'Demo User', username: 'demouser' };
        renderProfileHero(currentProfile);
      }
    } else if (cachedProfile) {
      currentProfile = cachedProfile;
      renderProfileHero(cachedProfile);
      renderPersonalStats(cachedProfile);
      renderBMI(cachedProfile);
      showToast('Using saved profile data', 'info');
    } else {
      showToast('Failed to load profile data', 'error');
    }
  }
}

function logout() {
  clearAuth();
  window.location.href = 'index.html';
}

/* ============ Init ============ */
initTheme();

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  if (item.getAttribute('data-page') === 'profile') item.classList.add('active');
});

document.addEventListener('DOMContentLoaded', loadProfilePage);
