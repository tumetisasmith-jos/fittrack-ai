const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : 'https://fittrack-ai.onrender.com/api';
function getToken() { return localStorage.getItem('fittrack_token'); }
function getUser()  { return JSON.parse(localStorage.getItem('fittrack_user') || '{}'); }
function logout()   { localStorage.removeItem('fittrack_token'); localStorage.removeItem('fittrack_user'); window.location.href = 'index.html'; }
if (!getToken())    { window.location.href = 'login.html'; }

async function api(ep, method='GET', data=null) {
  const o = { method, headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${getToken()}` } };
  if (data) o.body = JSON.stringify(data);
  const r = await fetch(`${API_BASE}${ep}`, o);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error||'Failed');
  return j;
}

function toast(msg, type='success') {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${msg}`;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); }, 3000);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay')?.classList.toggle('show'); }
function toggleTheme() {
  const light = document.documentElement.getAttribute('data-theme')==='light';
  if (!light) document.documentElement.setAttribute('data-theme','light'); else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('fittrack_theme', light?'dark':'light');
  document.getElementById('themeToggle').innerHTML = light?'<i class="fas fa-moon"></i>':'<i class="fas fa-sun"></i>';
}
function initTheme() { if (localStorage.getItem('fittrack_theme')==='light') { document.documentElement.setAttribute('data-theme','light'); const b=document.getElementById('themeToggle'); if(b) b.innerHTML='<i class="fas fa-sun"></i>'; } }

// ─── State ─────────────────────────────────────────────────────────────────
let currentDate = new Date();
let selectedMealType = 'breakfast';
let allMeals = [];
let trendChart = null;
let calRingChart = null;

const GOALS = { calories: 2000, protein: 150, carbs: 250, fat: 65 };

const QUICK_FOODS = {
  breakfast: [
    { food_name:'Oatmeal', calories:300, protein_g:10, carbs_g:55, fat_g:5 },
    { food_name:'Scrambled Eggs', calories:220, protein_g:18, carbs_g:2, fat_g:15 },
    { food_name:'Greek Yogurt', calories:150, protein_g:17, carbs_g:10, fat_g:2 },
    { food_name:'Protein Smoothie', calories:340, protein_g:32, carbs_g:38, fat_g:6 },
    { food_name:'Avocado Toast', calories:360, protein_g:10, carbs_g:35, fat_g:20 }
  ],
  lunch: [
    { food_name:'Chicken Salad', calories:380, protein_g:35, carbs_g:20, fat_g:12 },
    { food_name:'Quinoa Bowl', calories:420, protein_g:18, carbs_g:58, fat_g:10 },
    { food_name:'Turkey Wrap', calories:440, protein_g:30, carbs_g:44, fat_g:14 },
    { food_name:'Tuna Sandwich', calories:360, protein_g:28, carbs_g:38, fat_g:8 }
  ],
  dinner: [
    { food_name:'Baked Salmon', calories:480, protein_g:40, carbs_g:20, fat_g:22 },
    { food_name:'Chicken Stir-Fry', calories:420, protein_g:34, carbs_g:36, fat_g:12 },
    { food_name:'Beef Steak', calories:520, protein_g:44, carbs_g:4, fat_g:34 },
    { food_name:'Pasta Bolognese', calories:580, protein_g:32, carbs_g:64, fat_g:18 }
  ],
  snack: [
    { food_name:'Protein Bar', calories:210, protein_g:20, carbs_g:24, fat_g:6 },
    { food_name:'Mixed Nuts', calories:180, protein_g:6, carbs_g:8, fat_g:16 },
    { food_name:'Banana', calories:90, protein_g:1, carbs_g:23, fat_g:0 },
    { food_name:'Apple', calories:72, protein_g:0, carbs_g:19, fat_g:0 }
  ]
};

const MEAL_ICONS = { breakfast:'🌅', lunch:'☀️', dinner:'🌙', snack:'🍎' };

function todayStr() { return new Date().toISOString().split('T')[0]; }
function dateStr(d) { return d.toISOString().split('T')[0]; }
function isToday() { return dateStr(currentDate) === todayStr(); }

// ─── Init ───────────────────────────────────────────────────────────────────
async function loadPage() {
  initTheme();
  const user = getUser();
  const av = document.getElementById('userAvatar');
  if (av && user.full_name) av.textContent = user.full_name.charAt(0).toUpperCase();
  updateDateLabel();
  await Promise.all([loadMeals(), loadTrend(), loadNotifCount()]);
  initCalRing();
}

function updateDateLabel() {
  const el = document.getElementById('currentDateLabel');
  if (!el) return;
  if (isToday()) { el.textContent = 'Today'; }
  else {
    const d = currentDate.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    el.textContent = d;
  }
  document.getElementById('nextDayBtn').disabled = isToday();
}

function changeDate(delta) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + delta);
  if (d > new Date()) return;
  currentDate = d;
  updateDateLabel();
  loadMeals();
}

// ─── Load meals ─────────────────────────────────────────────────────────────
async function loadMeals() {
  try {
    const data = await api(`/meals?date=${dateStr(currentDate)}`);
    allMeals = data;
    renderSummary();
    renderMealSections();
  } catch (err) {
    document.getElementById('mealSections').innerHTML = `<div class="empty-state"><p class="empty-text">${err.message}</p></div>`;
  }
}

function renderSummary() {
  const totals = allMeals.reduce((a, m) => {
    a.cal += m.calories||0; a.protein += m.protein_g||0; a.carbs += m.carbs_g||0; a.fat += m.fat_g||0; return a;
  }, { cal:0, protein:0, carbs:0, fat:0 });

  document.getElementById('calConsumed').textContent = Math.round(totals.cal);
  document.getElementById('proteinVal').textContent  = Math.round(totals.protein) + 'g';
  document.getElementById('carbsVal').textContent    = Math.round(totals.carbs) + 'g';
  document.getElementById('fatVal').textContent      = Math.round(totals.fat) + 'g';
  document.getElementById('mealCount').textContent   = allMeals.length;

  const types = [...new Set(allMeals.map(m => MEAL_ICONS[m.meal_type] + ' ' + m.meal_type))];
  document.getElementById('mealTypesLogged').textContent = types.join(', ') || 'None logged';

  const calPct = Math.min(100, (totals.cal / GOALS.calories) * 100);
  document.getElementById('calProgressFill').style.width = calPct + '%';
  document.getElementById('proteinFill').style.width = Math.min(100,(totals.protein/GOALS.protein)*100) + '%';
  document.getElementById('carbsFill').style.width   = Math.min(100,(totals.carbs/GOALS.carbs)*100) + '%';
  document.getElementById('fatFill').style.width     = Math.min(100,(totals.fat/GOALS.fat)*100) + '%';

  const rem = GOALS.calories - Math.round(totals.cal);
  document.getElementById('calRemaining').textContent = rem >= 0 ? `${rem} kcal remaining` : `${Math.abs(rem)} kcal over goal`;

  updateCalRing(Math.round(totals.cal));
}

function initCalRing() {
  const ctx = document.getElementById('calRingChart')?.getContext('2d');
  if (!ctx) return;
  calRingChart = new Chart(ctx, {
    type:'doughnut',
    data:{ datasets:[{ data:[0, GOALS.calories], backgroundColor:['#10b981','rgba(255,255,255,0.05)'], borderWidth:0, circumference:270, rotation:225 }] },
    options:{ cutout:'80%', plugins:{ legend:{display:false}, tooltip:{enabled:false} }, animation:{duration:800} }
  });
}

function updateCalRing(consumed) {
  if (!calRingChart) return;
  const rem = Math.max(0, GOALS.calories - consumed);
  calRingChart.data.datasets[0].data = [consumed, rem];
  calRingChart.data.datasets[0].backgroundColor[0] = consumed > GOALS.calories ? '#ef4444' : '#10b981';
  calRingChart.update();
}

function renderMealSections() {
  const types = ['breakfast','lunch','dinner','snack'];
  const section = document.getElementById('mealSections');
  section.innerHTML = types.map(type => {
    const meals = allMeals.filter(m => m.meal_type === type);
    const totalCal = meals.reduce((s, m) => s + (m.calories||0), 0);
    return `
      <div class="meal-section">
        <div class="meal-section-header">
          <div class="meal-section-title">${MEAL_ICONS[type]} ${type.charAt(0).toUpperCase()+type.slice(1)}</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="meal-section-cal">${Math.round(totalCal)} kcal</span>
            <button class="btn btn-sm btn-secondary" onclick="openAddMealModal('${type}')"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        ${meals.length === 0
          ? `<div style="padding:12px;border:1px dashed var(--glass-border);border-radius:10px;text-align:center;color:var(--text-muted);font-size:0.85rem;">No ${type} logged yet</div>`
          : meals.map(m => `
            <div class="meal-item">
              <div>
                <div class="meal-item-name">${m.food_name}</div>
                <div class="meal-item-macros">P: ${m.protein_g||0}g · C: ${m.carbs_g||0}g · F: ${m.fat_g||0}g · ${m.quantity_g||100}g</div>
              </div>
              <div style="display:flex;align-items:center;">
                <span class="meal-item-cal">${m.calories||0} kcal</span>
                <button onclick="deleteMeal(${m.id})" style="background:none;border:none;color:var(--accent-red);cursor:pointer;padding:4px;"><i class="fas fa-trash"></i></button>
              </div>
            </div>`).join('')
        }
      </div>`;
  }).join('');
}

// ─── 7-day trend ─────────────────────────────────────────────────────────────
async function loadTrend() {
  try {
    const data = await api('/meals/summary');
    const last7 = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().split('T')[0];
      const found = data.find(r=>r.date===ds);
      last7.push({ date: d.toLocaleDateString('en-US',{weekday:'short'}), cal: found ? found.total_cal : 0 });
    }
    const ctx = document.getElementById('calorieTrendChart');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx.getContext('2d'), {
      type:'bar',
      data:{ labels:last7.map(d=>d.date), datasets:[{ label:'Calories', data:last7.map(d=>d.cal), backgroundColor:'rgba(16,185,129,0.6)', borderColor:'#10b981', borderWidth:1, borderRadius:6 }, { label:'Goal', data:Array(7).fill(GOALS.calories), type:'line', borderColor:'rgba(124,58,237,0.6)', borderWidth:2, pointRadius:0, fill:false }] },
      options:{ responsive:true, plugins:{ legend:{labels:{color:'var(--text-secondary)',font:{size:12}}} }, scales:{ y:{ beginAtZero:true, grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'var(--text-secondary)'} }, x:{ grid:{display:false}, ticks:{color:'var(--text-secondary)'} } } }
    });
  } catch (_) {}
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function openAddMealModal(type) {
  selectedMealType = type || 'breakfast';
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.toLowerCase().includes(selectedMealType));
  });
  renderQuickFoods();
  clearMealForm();
  document.getElementById('addMealModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAddMealModal() {
  document.getElementById('addMealModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function selectMealType(type, btn) {
  selectedMealType = type;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderQuickFoods();
}

function renderQuickFoods() {
  const grid = document.getElementById('quickFoodsGrid');
  const foods = QUICK_FOODS[selectedMealType] || [];
  grid.innerHTML = foods.map(f => `
    <div class="food-chip" onclick='fillFood(${JSON.stringify(f)})'>
      ${f.food_name} <small style="color:var(--text-muted)">${f.calories}kcal</small>
    </div>`).join('');
}

function fillFood(food) {
  document.getElementById('foodName').value     = food.food_name;
  document.getElementById('foodCalories').value = food.calories;
  document.getElementById('foodProtein').value  = food.protein_g;
  document.getElementById('foodCarbs').value    = food.carbs_g;
  document.getElementById('foodFat').value      = food.fat_g;
  document.getElementById('foodQty').value      = 100;
}

function clearMealForm() {
  ['foodName','foodQty','foodCalories','foodProtein','foodCarbs','foodFat'].forEach(id => document.getElementById(id) && (document.getElementById(id).value = id==='foodQty'?100:''));
}

async function saveMeal() {
  const btn  = document.getElementById('saveMealBtn');
  const name = document.getElementById('foodName').value.trim();
  if (!name) { toast('Please enter a food name.', 'error'); return; }
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;
  try {
    await api('/meals', 'POST', {
      meal_type: selectedMealType,
      food_name: name,
      quantity_g:  parseFloat(document.getElementById('foodQty').value)||100,
      calories:    parseInt(document.getElementById('foodCalories').value)||0,
      protein_g:   parseFloat(document.getElementById('foodProtein').value)||0,
      carbs_g:     parseFloat(document.getElementById('foodCarbs').value)||0,
      fat_g:       parseFloat(document.getElementById('foodFat').value)||0,
      date: dateStr(currentDate)
    });
    closeAddMealModal();
    toast(`${name} logged! 🥗`);
    await Promise.all([loadMeals(), loadTrend()]);
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.innerHTML = '<i class="fas fa-check"></i> Log Meal'; btn.disabled = false; }
}

async function deleteMeal(id) {
  if (!confirm('Delete this meal entry?')) return;
  try { await api(`/meals/${id}`, 'DELETE'); toast('Meal removed.'); await Promise.all([loadMeals(), loadTrend()]); }
  catch (err) { toast(err.message, 'error'); }
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function loadNotifCount() { try { const d=await api('/notifications/unread-count'); const b=document.getElementById('notifBadge'); if(b){b.textContent=d.count;b.classList.toggle('hidden',d.count===0);} } catch(_){} }
function toggleNotifications() { const p=document.getElementById('notifPanel'); if(!p) return; p.classList.toggle('hidden'); if(!p.classList.contains('hidden')) loadNotifications(); }
async function loadNotifications() { try { const ns=await api('/notifications'); document.getElementById('notifList').innerHTML = ns.length ? ns.slice(0,8).map(n=>`<div class="notif-item ${n.is_read?'':'notif-unread'}" onclick="markRead(${n.id},this)"><div class="notif-title">${n.title}</div><div class="notif-msg">${n.message}</div></div>`).join('') : '<div class="notif-empty">No notifications</div>'; } catch(_){} }
async function markRead(id,el) { try { await api(`/notifications/${id}/read`,'PUT'); el.classList.remove('notif-unread'); await loadNotifCount(); } catch(_){} }
async function markAllRead() { try { await api('/notifications/mark-all-read','POST'); document.querySelectorAll('.notif-unread').forEach(e=>e.classList.remove('notif-unread')); const b=document.getElementById('notifBadge'); if(b){b.textContent='0';b.classList.add('hidden');} } catch(_){} }
document.addEventListener('click',e=>{ const p=document.getElementById('notifPanel'); const bell=document.querySelector('.notification-bell'); if(p&&!p.contains(e.target)&&!bell?.contains(e.target)) p.classList.add('hidden'); });
document.getElementById('addMealModal')?.addEventListener('click',e=>{ if(e.target.id==='addMealModal') closeAddMealModal(); });

loadPage();
