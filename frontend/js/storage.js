/* Unified localStorage helpers — supports legacy hyphen and underscore keys */

function migrateStorageKeys() {
  const token = localStorage.getItem('fittrack-token');
  const user = localStorage.getItem('fittrack-user');
  const theme = localStorage.getItem('fittrack-theme');
  if (token && !localStorage.getItem('fittrack_token')) {
    localStorage.setItem('fittrack_token', token);
  }
  if (user && !localStorage.getItem('fittrack_user')) {
    localStorage.setItem('fittrack_user', user);
  }
  if (theme && !localStorage.getItem('fittrack_theme')) {
    localStorage.setItem('fittrack_theme', theme);
  }
}

function getToken() {
  migrateStorageKeys();
  return localStorage.getItem('fittrack_token') || localStorage.getItem('fittrack-token');
}

function getUser() {
  migrateStorageKeys();
  const raw = localStorage.getItem('fittrack_user') || localStorage.getItem('fittrack-user') || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function clearAuth() {
  ['fittrack_token', 'fittrack_user', 'fittrack-theme', 'fittrack-user'].forEach(k => {
    localStorage.removeItem(k);
  });
}

function setAuth(token, user) {
  localStorage.setItem('fittrack_token', token);
  localStorage.setItem('fittrack_user', JSON.stringify(user));
  localStorage.removeItem('fittrack-token');
  localStorage.removeItem('fittrack-user');
}

// ─── Global UI Population ──────────────────────────────────────────────────────
function populateGlobalUI() {
  const u = getUser();
  if (!u || !u.full_name) return;
  const first = u.full_name.split(' ')[0];
  const initials = u.full_name.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  
  const sbName = document.getElementById('sidebarName');
  const sbAv = document.getElementById('sidebarAvatar');
  const tbName = document.getElementById('topbarName');
  const tbAv = document.getElementById('userAvatar') || document.getElementById('topbarAvatar');
  const sbLevel = document.getElementById('sidebarLevel');

  if (sbName) sbName.textContent = u.full_name;
  if (sbAv) sbAv.textContent = initials;
  if (tbName) tbName.textContent = first;
  if (tbAv) tbAv.textContent = initials;
  if (sbLevel && u.level) sbLevel.innerHTML = `🏆 ${u.level} • ${u.xp_points || 0} XP`;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', populateGlobalUI);
}
