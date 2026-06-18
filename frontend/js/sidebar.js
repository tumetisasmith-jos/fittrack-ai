/* Collapsible sidebar — toggles width instead of blur overlay */

function toggleSidebar() {
  const app = document.querySelector('.app, .app-layout');
  if (!app) return;
  app.classList.toggle('sidebar-collapsed');
  const collapsed = app.classList.contains('sidebar-collapsed');
  localStorage.setItem('fittrack-sidebar-collapsed', collapsed ? '1' : '0');
  updateSidebarToggleIcon(collapsed);
}

function closeSidebar() {
  const app = document.querySelector('.app, .app-layout');
  if (!app) return;
  app.classList.add('sidebar-collapsed');
  localStorage.setItem('fittrack-sidebar-collapsed', '1');
  updateSidebarToggleIcon(true);
}

function updateSidebarToggleIcon(collapsed) {
  document.querySelectorAll('.topbar-hamburger i, .hamburger i').forEach(icon => {
    icon.className = collapsed ? 'fas fa-bars' : 'fas fa-times';
  });
}

function initSidebar() {
  const app = document.querySelector('.app, .app-layout');
  if (!app) return;
  const saved = localStorage.getItem('fittrack-sidebar-collapsed');
  const startCollapsed = saved === '1' || (saved === null && window.innerWidth <= 768);
  if (startCollapsed) {
    app.classList.add('sidebar-collapsed');
  }
  updateSidebarToggleIcon(app.classList.contains('sidebar-collapsed'));
}

document.addEventListener('DOMContentLoaded', initSidebar);
