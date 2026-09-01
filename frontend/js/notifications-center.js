const API_BASE=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'?'http://localhost:3000/api':'https://fittrack-ai.onrender.com/api';
function getToken(){return localStorage.getItem('fittrack_token');}
function getUser(){return JSON.parse(localStorage.getItem('fittrack_user')||'{}');}
function logout(){localStorage.removeItem('fittrack_token');localStorage.removeItem('fittrack_user');window.location.href='index.html';}
if(!getToken()){window.location.href='login.html';}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarOverlay')?.classList.toggle('show');}
function toggleTheme(){const l=document.documentElement.getAttribute('data-theme')==='light';if(!l)document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');localStorage.setItem('fittrack_theme',l?'dark':'light');document.getElementById('themeToggle').innerHTML=l?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';}
(()=>{if(localStorage.getItem('fittrack_theme')==='light'){document.documentElement.setAttribute('data-theme','light');const b=document.getElementById('themeToggle');if(b)b.innerHTML='<i class="fas fa-sun"></i>';}})();
async function api(ep,method='GET',data=null){const o={method,headers:{'Content-Type':'application/json','Authorization':`Bearer ${getToken()}`}};if(data)o.body=JSON.stringify(data);const r=await fetch(`${API_BASE}${ep}`,o);const j=await r.json();if(!r.ok)throw new Error(j.error||'Failed');return j;}

let allNotifications = [];
let typeFilter = 'all';

const TYPE_CONFIG = {
  achievement: { icon:'🏆', color:'#f59e0b', bg:'rgba(245,158,11,0.15)' },
  goal:        { icon:'🎯', color:'#10b981', bg:'rgba(16,185,129,0.15)' },
  reminder:    { icon:'💧', color:'#06b6d4', bg:'rgba(6,182,212,0.15)' },
  milestone:   { icon:'🎉', color:'#7c3aed', bg:'rgba(124,58,237,0.15)' },
  tip:         { icon:'💡', color:'#ec4899', bg:'rgba(236,72,153,0.15)' },
  system:      { icon:'⚙️', color:'#94a3b8', bg:'rgba(148,163,184,0.15)' }
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff/60000), hours = Math.floor(diff/3600000), days = Math.floor(diff/86400000);
  if (days>0) return `${days}d ago`;
  if (hours>0) return `${hours}h ago`;
  if (mins>0) return `${mins}m ago`;
  return 'Just now';
}

async function loadPage() {
  const u=getUser(); const av=document.getElementById('userAvatar'); if(av&&u.full_name) av.textContent=u.full_name.charAt(0).toUpperCase();
  await loadNotifications();
}

async function loadNotifications() {
  try {
    allNotifications = await api('/notifications');
    renderStats();
    renderList();
  } catch(err) { document.getElementById('notifList').innerHTML=`<p style="color:var(--text-muted)">${err.message}</p>`; }
}

function renderStats() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('totalNotifs').textContent  = allNotifications.length;
  document.getElementById('unreadNotifs').textContent = allNotifications.filter(n=>!n.is_read).length;
  document.getElementById('todayNotifs').textContent  = allNotifications.filter(n=>n.created_at.startsWith(today)).length;
}

function setTypeFilter(f,btn) { typeFilter=f; document.querySelectorAll('#typeFilters .filter-tab').forEach(t=>t.classList.remove('active')); btn.classList.add('active'); renderList(); }

function renderList() {
  const filtered = typeFilter==='all' ? allNotifications : allNotifications.filter(n=>n.type===typeFilter);
  const list = document.getElementById('notifList');
  if (!filtered.length) {
    list.innerHTML=`<div class="notif-empty-page"><div class="empty-icon">🔔</div><p style="color:var(--text-muted);">No notifications found.</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(n => {
    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
    return `
      <div class="notif-page-item ${n.is_read?'':'unread'}" id="notif-${n.id}" onclick="markRead(${n.id})">
        <div class="notif-icon-wrap" style="background:${cfg.bg};color:${cfg.color}">${cfg.icon}</div>
        <div class="notif-body">
          <div class="notif-title-p">${n.title}</div>
          <div class="notif-msg-p">${n.message}</div>
          <div class="notif-time-p"><i class="fas fa-clock" style="margin-right:4px;"></i>${timeAgo(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<div class="unread-indicator"></div>' : '<i class="fas fa-check" style="color:var(--text-muted);font-size:0.7rem;margin-top:4px;"></i>'}
      </div>`;
  }).join('');
}

async function markRead(id) {
  const item = document.getElementById(`notif-${id}`);
  const notif = allNotifications.find(n=>n.id===id);
  if (!notif || notif.is_read) return;
  try {
    await api(`/notifications/${id}/read`, 'PUT');
    notif.is_read = 1;
    item?.classList.remove('unread');
    item?.querySelector('.unread-indicator')?.remove();
    renderStats();
  } catch (_) {}
}

async function markAllRead() {
  try {
    await api('/notifications/mark-all-read','POST');
    allNotifications.forEach(n=>n.is_read=1);
    renderStats(); renderList();
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', loadPage);
