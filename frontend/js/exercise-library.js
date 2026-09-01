const API_BASE = window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'?'http://localhost:3000/api':'https://fittrack-ai.onrender.com/api';
function getToken(){return localStorage.getItem('fittrack_token');}
function logout(){localStorage.removeItem('fittrack_token');localStorage.removeItem('fittrack_user');window.location.href='index.html';}
if(!getToken()){window.location.href='login.html';}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarOverlay')?.classList.toggle('show');}
function toggleTheme(){const l=document.documentElement.getAttribute('data-theme')==='light';if(!l)document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');localStorage.setItem('fittrack_theme',l?'dark':'light');document.getElementById('themeToggle').innerHTML=l?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';}
(()=>{if(localStorage.getItem('fittrack_theme')==='light'){document.documentElement.setAttribute('data-theme','light');const b=document.getElementById('themeToggle');if(b)b.innerHTML='<i class="fas fa-sun"></i>';}})();

let allExercises = [];

const CAT_COLORS = { Cardio:'#ef4444', Strength:'#06b6d4', HIIT:'#ec4899', Flexibility:'#8b5cf6', Sports:'#f59e0b', Recovery:'#10b981' };

async function loadExercises() {
  try {
    const token = getToken();
    const r = await fetch(`${API_BASE}/exercises`, { headers:{'Authorization':`Bearer ${token}`} });
    allExercises = await r.json();

    // Populate category filter
    const cats = [...new Set(allExercises.map(e=>e.category))].sort();
    const sel = document.getElementById('categoryFilter');
    cats.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });

    filterExercises();
  } catch (err) {
    document.getElementById('exerciseGrid').innerHTML = `<div class="empty-state"><p class="empty-text">${err.message}</p></div>`;
  }
}

function filterExercises() {
  const q    = document.getElementById('searchInput').value.toLowerCase();
  const cat  = document.getElementById('categoryFilter').value;
  const diff = document.getElementById('difficultyFilter').value;

  const filtered = allExercises.filter(e => {
    const matchQ    = !q || e.name.toLowerCase().includes(q) || (e.muscle_groups||'').toLowerCase().includes(q) || (e.description||'').toLowerCase().includes(q);
    const matchCat  = cat==='all'  || e.category===cat;
    const matchDiff = diff==='all' || e.difficulty===diff;
    return matchQ && matchCat && matchDiff;
  });

  document.getElementById('exCount').textContent = `Showing ${filtered.length} of ${allExercises.length} exercises`;
  renderGrid(filtered);
}

function renderGrid(exercises) {
  const grid = document.getElementById('exerciseGrid');
  if (!exercises.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p class="empty-text">No exercises match your search.</p></div>`;
    return;
  }
  grid.innerHTML = exercises.map(e => {
    const color = CAT_COLORS[e.category] || '#7c3aed';
    const diffClass = `diff-${e.difficulty}`;
    return `
      <div class="exercise-card" onclick="showExercise(${e.id})">
        <div class="ex-header">
          <div class="ex-name">${e.name}</div>
          <span class="ex-category-badge" style="background:${color}22;color:${color}">${e.category}</span>
        </div>
        <div class="ex-muscles"><i class="fas fa-person-running" style="color:${color};margin-right:4px;"></i>${e.muscle_groups||'—'}</div>
        <div class="ex-desc">${e.description||''}</div>
        <div class="ex-footer">
          <span class="difficulty-badge ${diffClass}">${e.difficulty}</span>
          <span class="ex-tag"><i class="fas fa-fire"></i> <span class="ex-cal">${e.calories_per_minute}</span> kcal/min</span>
          <span class="ex-tag">${e.equipment||'none'}</span>
        </div>
      </div>`;
  }).join('');
}

function showExercise(id) {
  const e = allExercises.find(x=>x.id===id);
  if (!e) return;
  const color = CAT_COLORS[e.category] || '#7c3aed';
  const diffClass = `diff-${e.difficulty}`;
  document.getElementById('exModalTitle').textContent = e.name;
  document.getElementById('exModalBody').innerHTML = `
    <div class="detail-row">
      <span class="detail-badge" style="background:${color}22;color:${color}">${e.category}</span>
      <span class="difficulty-badge ${diffClass}">${e.difficulty}</span>
      <span class="detail-badge" style="background:rgba(245,158,11,0.1);color:#f59e0b;"><i class="fas fa-fire"></i> ${e.calories_per_minute} kcal/min</span>
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px;">Muscle Groups</div>
      <div style="color:var(--text-primary)">${e.muscle_groups||'—'}</div>
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px;">Equipment</div>
      <div style="color:var(--text-primary)">${e.equipment||'None required'}</div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px;">Description</div>
      <div style="color:var(--text-secondary)">${e.description||''}</div>
    </div>
    <div>
      <div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px;">How to Perform</div>
      <div class="instructions-box">${(e.instructions||'').replace(/\. /g,'.<br>')}</div>
    </div>`;
  document.getElementById('exModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeExModal() { document.getElementById('exModal').classList.add('hidden'); document.body.style.overflow = ''; }
document.getElementById('exModal')?.addEventListener('click', e => { if (e.target.id==='exModal') closeExModal(); });
document.addEventListener('DOMContentLoaded', loadExercises);
