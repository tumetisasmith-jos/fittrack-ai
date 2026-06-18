const API_BASE=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'?'http://localhost:3000/api':window.location.origin+'/api';
function getToken(){return localStorage.getItem('fittrack_token');}
function getUser(){return JSON.parse(localStorage.getItem('fittrack_user')||'{}');}
function logout(){localStorage.removeItem('fittrack_token');localStorage.removeItem('fittrack_user');window.location.href='index.html';}
if(!getToken()){window.location.href='login.html';}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarOverlay')?.classList.toggle('show');}
function toggleTheme(){const l=document.documentElement.getAttribute('data-theme')==='light';if(!l)document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');localStorage.setItem('fittrack_theme',l?'dark':'light');document.getElementById('themeToggle').innerHTML=l?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';}
(()=>{if(localStorage.getItem('fittrack_theme')==='light'){document.documentElement.setAttribute('data-theme','light');const b=document.getElementById('themeToggle');if(b)b.innerHTML='<i class="fas fa-sun"></i>';}})();
async function api(ep,method='GET',data=null){const o={method,headers:{'Content-Type':'application/json','Authorization':`Bearer ${getToken()}`}};if(data)o.body=JSON.stringify(data);const r=await fetch(`${API_BASE}${ep}`,o);const j=await r.json();if(!r.ok)throw new Error(j.error||'Failed');return j;}
function toast(msg,type='success'){const t=document.createElement('div');t.className=`toast toast-${type}`;t.innerHTML=`<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${msg}`;document.body.appendChild(t);requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);}

let allSchedules = [];
let statusFilter = 'all';

const TYPE_ICONS = { Running:'🏃', Cycling:'🚴', Yoga:'🧘', 'Strength Training':'💪', Swimming:'🏊', HIIT:'⚡', Walking:'🚶', Pilates:'🤸', Boxing:'🥊', Basketball:'🏀', Other:'🏅' };

async function loadPage() {
  const u=getUser(); const av=document.getElementById('userAvatar'); if(av&&u.full_name) av.textContent=u.full_name.charAt(0).toUpperCase();
  document.getElementById('schedDate').value = new Date(Date.now()+86400000).toISOString().split('T')[0];
  await Promise.all([loadSchedules(), loadUpcoming(), loadNotifCount()]);
}

async function loadSchedules() {
  try {
    allSchedules = await api('/schedules');
    renderStats();
    renderAllSchedules();
  } catch (err) { document.getElementById('allScheduleList').innerHTML=`<p style="color:var(--text-muted)">${err.message}</p>`; }
}

async function loadUpcoming() {
  try {
    const upcoming = await api('/schedules/upcoming');
    const list = document.getElementById('upcomingList');
    if (!upcoming.length) { list.innerHTML='<div class="empty-state" style="padding:20px;text-align:center;"><div style="font-size:2rem">📅</div><p style="color:var(--text-muted);margin-top:8px;">No upcoming workouts scheduled.</p><button class="btn btn-sm btn-primary" style="margin-top:12px;" onclick="openAddSchedule()">Schedule One</button></div>'; return; }
    list.innerHTML = upcoming.map(s => renderSchedItem(s)).join('');
  } catch (_) {}
}

function renderStats() {
  const pending   = allSchedules.filter(s=>s.status==='pending').length;
  const completed = allSchedules.filter(s=>s.status==='completed').length;
  const total     = allSchedules.length;
  document.getElementById('schedStats').innerHTML = `
    <div class="mini-stat"><div class="mini-stat-val" style="color:var(--accent-purple)">${pending}</div><div class="mini-stat-label">Upcoming</div></div>
    <div class="mini-stat"><div class="mini-stat-val" style="color:#10b981">${completed}</div><div class="mini-stat-label">Completed</div></div>
    <div class="mini-stat"><div class="mini-stat-val">${total}</div><div class="mini-stat-label">Total</div></div>`;
}

function renderAllSchedules() {
  const filtered = statusFilter==='all' ? allSchedules : allSchedules.filter(s=>s.status===statusFilter);
  const list = document.getElementById('allScheduleList');
  if (!filtered.length) { list.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);">No schedules found.</div>'; return; }
  list.innerHTML = filtered.slice(0,20).map(s => renderSchedItem(s)).join('');
}

function renderSchedItem(s) {
  const d    = new Date(s.scheduled_date+'T00:00:00');
  const day  = d.getDate();
  const mon  = d.toLocaleDateString('en-US',{month:'short'});
  const icon = TYPE_ICONS[s.workout_type]||'🏅';
  const badgeClass = `badge-${s.status}`;
  return `
    <div class="sched-item status-${s.status}">
      <div class="sched-date-col"><div class="sched-day">${day}</div><div class="sched-month">${mon}</div></div>
      <div class="sched-info">
        <div class="sched-title">${icon} ${s.title}</div>
        <div class="sched-meta"><i class="fas fa-clock"></i> ${s.scheduled_time} · ${s.duration_minutes} min · ${s.workout_type}</div>
        <div class="sched-actions">
          <span class="sched-status-badge ${badgeClass}">${s.status}</span>
          ${s.status==='pending' ? `
            <button class="btn btn-sm btn-secondary" onclick="updateStatus(${s.id},'completed')"><i class="fas fa-check"></i></button>
            <button class="btn btn-sm btn-secondary" onclick="updateStatus(${s.id},'skipped')"><i class="fas fa-forward"></i></button>
          ` : ''}
          <button class="btn btn-sm" style="background:rgba(239,68,68,.1);color:#ef4444;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;" onclick="deleteSchedule(${s.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
}

function setStatusFilter(f,btn) { statusFilter=f; document.querySelectorAll('#statusFilters .filter-tab').forEach(t=>t.classList.remove('active')); btn.classList.add('active'); renderAllSchedules(); }

async function updateStatus(id,status) {
  try { await api(`/schedules/${id}`,'PUT',{status}); toast(`Marked as ${status}!`); await Promise.all([loadSchedules(),loadUpcoming()]); }
  catch(err) { toast(err.message,'error'); }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this scheduled workout?')) return;
  try { await api(`/schedules/${id}`,'DELETE'); toast('Deleted.'); await Promise.all([loadSchedules(),loadUpcoming()]); }
  catch(err) { toast(err.message,'error'); }
}

function openAddSchedule() { document.getElementById('addSchedModal').classList.remove('hidden'); document.body.style.overflow='hidden'; }
function closeAddSchedule() { document.getElementById('addSchedModal').classList.add('hidden'); document.body.style.overflow=''; }

async function saveSchedule() {
  const btn  = document.getElementById('saveSchedBtn');
  const title= document.getElementById('schedTitle').value.trim();
  const date = document.getElementById('schedDate').value;
  if (!title||!date) { toast('Title and date are required.','error'); return; }
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; btn.disabled=true;
  try {
    await api('/schedules','POST',{ title, workout_type:document.getElementById('schedType').value, scheduled_date:date, scheduled_time:document.getElementById('schedTime').value, duration_minutes:parseInt(document.getElementById('schedDuration').value)||30, notes:document.getElementById('schedNotes').value.trim()||null });
    closeAddSchedule(); toast('Workout scheduled! 📅');
    await Promise.all([loadSchedules(),loadUpcoming()]);
  } catch(err) { toast(err.message,'error'); }
  finally { btn.innerHTML='<i class="fas fa-check"></i> Schedule'; btn.disabled=false; }
}

async function loadNotifCount(){try{const d=await api('/notifications/unread-count');const b=document.getElementById('notifBadge');if(b){b.textContent=d.count;b.classList.toggle('hidden',d.count===0);}}catch(_){}}
function toggleNotifications(){const p=document.getElementById('notifPanel');if(!p)return;p.classList.toggle('hidden');}
async function markAllRead(){try{await api('/notifications/mark-all-read','POST');}catch(_){}}
document.getElementById('addSchedModal')?.addEventListener('click',e=>{if(e.target.id==='addSchedModal')closeAddSchedule();});
document.addEventListener('DOMContentLoaded',loadPage);
