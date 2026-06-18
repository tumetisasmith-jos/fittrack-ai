const API_BASE=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'?'http://localhost:3000/api':window.location.origin+'/api';
function getToken(){return localStorage.getItem('fittrack_token');}
function getUser(){return JSON.parse(localStorage.getItem('fittrack_user')||'{}');}
function logout(){localStorage.removeItem('fittrack_token');localStorage.removeItem('fittrack_user');window.location.href='index.html';}
if(!getToken()){window.location.href='login.html';}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarOverlay')?.classList.toggle('show');}
function toggleTheme(){const l=document.documentElement.getAttribute('data-theme')==='light';if(!l)document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');localStorage.setItem('fittrack_theme',l?'dark':'light');document.getElementById('themeToggle').innerHTML=l?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';}
(()=>{if(localStorage.getItem('fittrack_theme')==='light'){document.documentElement.setAttribute('data-theme','light');const b=document.getElementById('themeToggle');if(b)b.innerHTML='<i class="fas fa-sun"></i>';}})();
async function api(ep,method='GET',data=null){const o={method,headers:{'Content-Type':'application/json','Authorization':`Bearer ${getToken()}`}};if(data)o.body=JSON.stringify(data);const r=await fetch(`${API_BASE}${ep}`,o);const j=await r.json();if(!r.ok)throw new Error(j.error||'Failed');return j;}
function toast(msg,type='success'){document.querySelectorAll('.toast').forEach(t=>t.remove());const t=document.createElement('div');t.className=`toast toast-${type}`;t.innerHTML=`<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${msg}`;document.body.appendChild(t);requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);}

let selectedCtx='resting';
let trendChart=null, distChart=null;

function getBpmStatus(bpm, ctx) {
  if (ctx==='sleeping') { return bpm<40?'Very Low 😟':bpm<60?'Good 😴':bpm<80?'Slightly Elevated':'High 😟'; }
  if (ctx==='resting')  { return bpm<50?'Athletic 🏆':bpm<60?'Excellent ✅':bpm<70?'Good 💚':bpm<80?'Normal 🟡':bpm<90?'Slightly High ⚠️':'High ❌'; }
  if (ctx==='active')   { return bpm<100?'Light Zone 🟢':bpm<130?'Fat Burn 🟡':bpm<160?'Cardio Zone 🔶':bpm<185?'Peak Zone 🔴':'Max Effort 💥'; }
  return bpm<100?'Recovery ✅':bpm<130?'Elevated':'High';
}

function getBpmColor(bpm,ctx) {
  if (ctx==='resting') return bpm<60?'#10b981':bpm<80?'#f59e0b':'#ef4444';
  if (ctx==='active')  return bpm<130?'#10b981':bpm<160?'#f59e0b':'#ef4444';
  return '#06b6d4';
}

async function loadPage() {
  const u=getUser(); const av=document.getElementById('userAvatar'); if(av&&u.full_name) av.textContent=u.full_name.charAt(0).toUpperCase();
  await Promise.all([loadStats(), loadHistory(), loadNotifCount()]);
}

async function loadStats() {
  try {
    const s = await api('/heart-rate/stats');
    document.getElementById('hrAvg').textContent     = s.avg||'—';
    document.getElementById('hrMin').textContent     = s.min||'—';
    document.getElementById('hrMax').textContent     = s.max||'—';
    document.getElementById('hrResting').textContent = s.resting_avg||'—';
    if (s.latest) {
      const bpm=s.latest.bpm, ctx=s.latest.context;
      document.getElementById('latestBpm').textContent   = bpm;
      document.getElementById('latestBpm').style.color   = getBpmColor(bpm,ctx);
      document.getElementById('latestCtx').textContent   = `Latest: ${ctx} · ${new Date(s.latest.recorded_at).toLocaleString()}`;
      const statusEl = document.getElementById('bpmStatus');
      statusEl.textContent = getBpmStatus(bpm,ctx);
      statusEl.style.background = getBpmColor(bpm,ctx)+'22'; statusEl.style.color = getBpmColor(bpm,ctx);
    }
    buildTrendChart(s.trend||[]);
  } catch (err) { console.error(err); }
}

async function loadHistory() {
  try {
    const rows = await api('/heart-rate');
    const tbody = document.getElementById('hrTableBody');
    if (!rows.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">No readings yet. Log your first one!</td></tr>'; buildDistChart([]); return; }
    tbody.innerHTML = rows.slice(0,30).map(r => {
      const ctx = r.context||'resting';
      const ts  = new Date(r.recorded_at).toLocaleString();
      return `<tr>
        <td>${ts}</td>
        <td><strong style="color:${getBpmColor(r.bpm,ctx)};font-size:1.05rem;">${r.bpm}</strong> <span style="color:var(--text-muted);font-size:0.75rem;">bpm</span></td>
        <td><span class="ctx-badge ctx-${ctx.replace('-','-')}">${ctx}</span></td>
        <td style="color:var(--text-muted)">${r.notes||'—'}</td>
        <td><button onclick="deleteHr(${r.id})" style="background:none;border:none;color:var(--accent-red);cursor:pointer;"><i class="fas fa-trash"></i></button></td>
      </tr>`;
    }).join('');
    buildDistChart(rows);
  } catch(err) { console.error(err); }
}

function buildTrendChart(trend) {
  // Fill 14 days
  const days = [];
  for (let i=13;i>=0;i--) { const d=new Date();d.setDate(d.getDate()-i);days.push({date:d.toISOString().split('T')[0],label:d.toLocaleDateString('en-US',{weekday:'short',month:'numeric',day:'numeric'})}); }
  const data = days.map(d => { const f=trend.find(t=>t.date===d.date); return f?f.avg_bpm:null; });
  const ctx  = document.getElementById('hrTrendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type:'line',
    data:{ labels:days.map(d=>d.label), datasets:[{ label:'Avg BPM', data, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.1)', fill:true, tension:0.4, pointBackgroundColor:'#ef4444', spanGaps:true }] },
    options:{ responsive:true, plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:false, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'var(--text-secondary)'} }, x:{ grid:{display:false}, ticks:{color:'var(--text-secondary)',maxTicksLimit:7} } } }
  });
}

function buildDistChart(rows) {
  const counts = { resting:0, active:0, 'post-workout':0, sleeping:0 };
  rows.forEach(r => { if (counts[r.context]!==undefined) counts[r.context]++; });
  const ctx = document.getElementById('hrDistChart').getContext('2d');
  if (distChart) distChart.destroy();
  distChart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:['Resting','Active','Post-Workout','Sleeping'], datasets:[{ data:Object.values(counts), backgroundColor:['rgba(16,185,129,.7)','rgba(239,68,68,.7)','rgba(245,158,11,.7)','rgba(99,102,241,.7)'], borderWidth:0 }] },
    options:{ responsive:true, plugins:{ legend:{labels:{color:'var(--text-secondary)',font:{size:11}}} }, cutout:'65%' }
  });
}

function openLogModal() { document.getElementById('logHrModal').classList.remove('hidden'); document.body.style.overflow='hidden'; document.getElementById('hrBpm').value=''; }
function closeLogModal() { document.getElementById('logHrModal').classList.add('hidden'); document.body.style.overflow=''; }
function selectCtx(ctx,btn) { selectedCtx=ctx; document.querySelectorAll('#logHrModal .filter-tab').forEach(t=>t.classList.remove('active')); btn.classList.add('active'); }

async function saveHr() {
  const btn=document.getElementById('saveHrBtn');
  const bpm=parseInt(document.getElementById('hrBpm').value);
  if (!bpm||bpm<30||bpm>250) { toast('Enter a valid BPM (30-250).','error'); return; }
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; btn.disabled=true;
  try {
    await api('/heart-rate','POST',{bpm,context:selectedCtx,notes:document.getElementById('hrNotes').value.trim()||null});
    closeLogModal(); toast(`${bpm} bpm logged! ❤️`); await Promise.all([loadStats(),loadHistory()]);
  } catch(err) { toast(err.message,'error'); }
  finally { btn.innerHTML='<i class="fas fa-heart"></i> Save Reading'; btn.disabled=false; }
}

async function deleteHr(id) { if(!confirm('Delete this reading?')) return; try{await api(`/heart-rate/${id}`,'DELETE');toast('Deleted.');await Promise.all([loadStats(),loadHistory()]);}catch(err){toast(err.message,'error');} }
async function loadNotifCount(){try{const d=await api('/notifications/unread-count');const b=document.getElementById('notifBadge');if(b){b.textContent=d.count;b.classList.toggle('hidden',d.count===0);}}catch(_){}}
function toggleNotifications(){const p=document.getElementById('notifPanel');if(!p)return;p.classList.toggle('hidden');}
async function markAllRead(){try{await api('/notifications/mark-all-read','POST');}catch(_){}}
document.getElementById('logHrModal')?.addEventListener('click',e=>{if(e.target.id==='logHrModal')closeLogModal();});
document.addEventListener('DOMContentLoaded',loadPage);
