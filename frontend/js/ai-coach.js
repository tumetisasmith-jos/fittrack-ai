// ── Auth & Helpers ──────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : window.location.origin + '/api';
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

// ── State ─────────────────────────────────────────────────────────────────────
let selectedGoal = null;
let currentTip = 0;
let tipTimer = null;
let recentLogs = [];
let recentWorkouts = [];

// ── Workout plans ─────────────────────────────────────────────────────────────
const PLANS = {
  weight_loss: {
    schedule: [
      { day: 'Monday',    focus: 'HIIT Cardio',       exercises: 'Jumping jacks × 3 sets, Burpees × 3 sets, Mountain climbers × 3 sets, Jump rope 10 min', duration: '45 min' },
      { day: 'Tuesday',   focus: 'Upper Body Strength', exercises: 'Push-ups × 4 sets, Dumbbell rows × 3 sets, Shoulder press × 3 sets, Tricep dips × 3 sets', duration: '40 min' },
      { day: 'Wednesday', focus: 'Active Recovery',   exercises: 'Brisk walk 30 min, Yoga flow 15 min, Foam rolling', duration: '45 min', rest: true },
      { day: 'Thursday',  focus: 'Lower Body Burn',   exercises: 'Squats × 4 sets, Lunges × 3 sets, Glute bridges × 3 sets, Calf raises × 3 sets', duration: '45 min' },
      { day: 'Friday',    focus: 'Core & Cardio',     exercises: 'Plank 3 × 60 sec, Russian twists × 3 sets, Bicycle crunches × 3 sets, Cycling 20 min', duration: '50 min' },
      { day: 'Saturday',  focus: 'Long Cardio',       exercises: 'Run or cycle 40–60 min at moderate pace (Zone 2)', duration: '60 min' },
      { day: 'Sunday',    focus: 'Rest Day',          exercises: 'Complete rest or light stretching', duration: '—', rest: true },
    ],
    tips: [
      { icon: '🥗', text: 'Eat in a 500 kcal deficit — no more, or you risk losing muscle.' },
      { icon: '🏃', text: 'Do at least 10,000 steps daily to maximise fat burn.' },
      { icon: '💧', text: 'Drink 2.5–3L of water — hydration boosts metabolism.' },
      { icon: '😴', text: 'Sleep 7–9 hours; poor sleep spikes ghrelin (hunger hormone).' },
      { icon: '🍳', text: 'Eat high-protein meals (≥ 0.8g/lb bodyweight) to preserve muscle.' },
    ],
  },
  muscle_gain: {
    schedule: [
      { day: 'Monday',    focus: 'Chest & Triceps',    exercises: 'Bench press × 4, Incline dumbbell press × 3, Cable flyes × 3, Tricep pushdowns × 4, Overhead tricep ext × 3', duration: '60 min' },
      { day: 'Tuesday',   focus: 'Back & Biceps',      exercises: 'Deadlift × 4, Pull-ups × 4, Seated cable rows × 3, Barbell curls × 4, Hammer curls × 3', duration: '60 min' },
      { day: 'Wednesday', focus: 'Active Recovery',    exercises: 'Light cardio 20 min, Mobility work, Foam rolling', duration: '30 min', rest: true },
      { day: 'Thursday',  focus: 'Shoulders & Arms',   exercises: 'Overhead press × 4, Lateral raises × 3, Front raises × 3, Face pulls × 3, Preacher curls × 3', duration: '55 min' },
      { day: 'Friday',    focus: 'Legs',               exercises: 'Squats × 5, Leg press × 4, Romanian deadlifts × 3, Leg curls × 3, Calf raises × 4', duration: '65 min' },
      { day: 'Saturday',  focus: 'Full Body Power',    exercises: 'Power cleans × 4, Weighted dips × 3, Weighted pull-ups × 3, Farmer carries × 4', duration: '55 min' },
      { day: 'Sunday',    focus: 'Rest & Recover',     exercises: 'Complete rest, light stretching, meal prep', duration: '—', rest: true },
    ],
    tips: [
      { icon: '🥩', text: 'Consume 1.6–2.2g of protein per kg bodyweight daily.' },
      { icon: '📈', text: 'Apply progressive overload — add weight or reps each week.' },
      { icon: '🍚', text: 'Eat 300 kcal surplus on training days to fuel growth.' },
      { icon: '💤', text: 'Growth hormone peaks during deep sleep — prioritise 8 hours.' },
      { icon: '🔁', text: 'Allow 48h rest per muscle group for proper recovery.' },
    ],
  },
  maintenance: {
    schedule: [
      { day: 'Monday',    focus: 'Full Body Strength', exercises: 'Squats × 3, Push-ups × 3, Rows × 3, Shoulder press × 3', duration: '45 min' },
      { day: 'Tuesday',   focus: 'Cardio',             exercises: 'Jog 30 min or cycle 45 min at comfortable pace', duration: '30–45 min' },
      { day: 'Wednesday', focus: 'Yoga & Flexibility', exercises: 'Full yoga flow, hip flexor stretches, spine mobility', duration: '40 min', rest: true },
      { day: 'Thursday',  focus: 'Full Body Strength', exercises: 'Deadlifts × 3, Lunges × 3, Dips × 3, Pull-ups × 3', duration: '45 min' },
      { day: 'Friday',    focus: 'Active Play',        exercises: 'Sport, hiking, swimming, dancing — anything fun!', duration: '60 min' },
      { day: 'Saturday',  focus: 'Light Cardio',       exercises: 'Walk 45–60 min, bike ride, light swim', duration: '45–60 min' },
      { day: 'Sunday',    focus: 'Rest',               exercises: 'Rest, relax, meal prep for the week', duration: '—', rest: true },
    ],
    tips: [
      { icon: '⚖️', text: 'Track calories at maintenance (TDEE) — weighing weekly is enough.' },
      { icon: '🎯', text: 'Keep workouts consistent — aim for 3–4 sessions per week.' },
      { icon: '🥦', text: 'Focus on nutrient-dense whole foods rather than counting macros.' },
      { icon: '🧘', text: 'Manage stress levels — cortisol can cause unwanted fat gain.' },
      { icon: '🚿', text: 'Stay hydrated — 2L of water minimum per day.' },
    ],
  }
};

// ── Daily tips ─────────────────────────────────────────────────────────────────
const DAILY_TIPS = [
  { icon: '🌅', text: 'Start your morning with a glass of water before coffee to kickstart your metabolism.', tag: 'Hydration' },
  { icon: '🥗', text: 'Aim for half your plate to be vegetables at every meal for optimal micronutrient intake.', tag: 'Nutrition' },
  { icon: '💪', text: 'Compound exercises like squats and deadlifts burn more calories than isolation moves.', tag: 'Training' },
  { icon: '😴', text: 'A consistent sleep schedule (same time every night) improves sleep quality significantly.', tag: 'Recovery' },
  { icon: '🚶', text: 'Taking 10-minute walks after meals improves blood sugar control and digestion.', tag: 'Activity' },
  { icon: '🎯', text: 'Write down your workouts — people who track progress are 40% more likely to hit goals.', tag: 'Mindset' },
  { icon: '🍗', text: 'Protein takes more energy to digest — eating 30g at each meal reduces total calorie intake.', tag: 'Nutrition' },
  { icon: '🧘', text: 'Even 10 minutes of meditation reduces cortisol, which causes belly fat storage.', tag: 'Wellness' },
  { icon: '🏃', text: 'Zone 2 cardio (conversational pace) is the most effective fat-burning heart rate zone.', tag: 'Cardio' },
  { icon: '⏰', text: 'Eating the bulk of your calories earlier in the day supports better body composition.', tag: 'Nutrition' },
  { icon: '🦵', text: 'Strong legs improve posture, balance, and metabolic rate — never skip leg day!', tag: 'Training' },
  { icon: '🧂', text: 'Reduce sodium intake to minimise water retention and bloating.', tag: 'Nutrition' },
  { icon: '📱', text: 'Limit screen time 1 hour before bed — blue light disrupts melatonin production.', tag: 'Recovery' },
  { icon: '🫀', text: 'Cardiovascular health is improved by just 150 minutes of moderate exercise per week.', tag: 'Health' },
  { icon: '🧃', text: 'Avoid liquid calories like juice and soda — they don\'t trigger fullness signals.', tag: 'Nutrition' },
];

// ── Chat Q&A responses ────────────────────────────────────────────────────────
const QA_PATTERNS = [
  { keywords: ['calorie', 'how many calories', 'kcal', 'caloric'], response: '🔥 Your calorie needs depend on your goals. For weight loss: TDEE − 500 kcal. For muscle gain: TDEE + 300 kcal. Use your AI Coach plan above for a personalised target based on the Mifflin-St Jeor formula!' },
  { keywords: ['beginner', 'start', 'new to', 'just started', 'getting started'], response: '🌟 Welcome! Start with 3 days/week of full-body workouts. Focus on learning compound movements (squat, push-up, row) with perfect form before adding weight. Consistency beats intensity when you\'re starting out!' },
  { keywords: ['protein', 'muscle', 'build muscle', 'protein intake'], response: '💪 Aim for 1.6–2.2g of protein per kg of bodyweight daily. Great sources: chicken breast, eggs, Greek yogurt, cottage cheese, fish, and lentils. Spread your protein over 4–5 meals for best muscle protein synthesis.' },
  { keywords: ['lose weight', 'weight loss', 'fat loss', 'burn fat', 'slim'], response: '⚖️ Sustainable fat loss comes from a 300–500 kcal deficit + 3–4 weekly workouts. Prioritise protein, sleep, and steps. Avoid crash diets — they cause muscle loss and metabolic adaptation.' },
  { keywords: ['sleep', 'rest', 'recovery', 'tired', 'insomnia'], response: '😴 Sleep is when your body repairs and grows muscle! Aim for 7–9 hours. Keep a consistent schedule, avoid caffeine after 2pm, and darken your room. Poor sleep raises cortisol and ghrelin — making fat loss harder.' },
  { keywords: ['cardio', 'running', 'jogging', 'aerobic'], response: '🏃 Cardio is great for heart health and fat burn. Mix Zone 2 (conversational pace, 30–60 min) with 1–2 HIIT sessions per week. Don\'t do intense cardio and heavy lifting on the same day if you can avoid it.' },
  { keywords: ['strength', 'weights', 'lifting', 'resistance', 'weight training'], response: '🏋️ Strength training 3–4x/week is optimal. Focus on progressive overload — gradually increasing weight or reps. Key lifts: squat, deadlift, bench press, overhead press, and rows. Rest 48–72h between training the same muscle group.' },
  { keywords: ['hydration', 'water', 'drink', 'dehydrat'], response: '💧 Drink at least 2–3 litres of water daily. Add 500ml for every hour of exercise. Signs of dehydration: dark urine, headache, poor performance. Electrolytes (sodium, potassium) matter too — especially after sweating!' },
  { keywords: ['bmi', 'overweight', 'body mass', 'healthy weight'], response: '📊 BMI is a rough guide: under 18.5 = underweight, 18.5–24.9 = healthy, 25–29.9 = overweight, 30+ = obese. However, BMI doesn\'t account for muscle mass — a muscular person may have a high BMI but excellent health.' },
  { keywords: ['motivation', 'tired of', 'give up', 'quit', 'not motivated', 'demotiv'], response: '🔥 Motivation fades — habits don\'t. Try: tracking small wins, working out with a friend, changing your routine, or setting a 2-week mini-goal. Remember: you\'ve already taken the hardest step by starting. Keep going!' },
  { keywords: ['yoga', 'flexibility', 'stretch', 'mobility', 'foam roll'], response: '🧘 Flexibility and mobility are underrated! Aim for 10–15 min of stretching daily. Yoga improves posture, reduces injury risk, and helps recovery. Focus on hip flexors, hamstrings, and thoracic spine.' },
  { keywords: ['diet', 'food', 'eat', 'nutrition', 'meal', 'healthy eating'], response: '🥗 A balanced diet includes: lean proteins, complex carbs, healthy fats, and plenty of vegetables. Focus on whole, minimally processed foods 80% of the time. The 20% for treats keeps you sane and sustainable!' },
  { keywords: ['creatine', 'supplement', 'pre-workout', 'protein powder'], response: '💊 Supplements that are well-evidenced: creatine monohydrate (3–5g/day, best for strength), protein powder (convenient but not magic), caffeine (performance boost). Most others have weak evidence — focus on food first!' },
  { keywords: ['plank', 'core', 'abs', 'six pack', 'stomach'], response: '🔲 Core strength is about more than six-packs! Include: planks (3 × 60sec), dead bugs, bird dogs, and pallof press. Six-pack visibility is mainly diet-related — you need low enough body fat to see them.' },
  { keywords: ['intermittent fasting', 'if', '16:8', 'fasting'], response: '⏰ Intermittent fasting (16:8 or 18:6) can help reduce overall calorie intake naturally. It\'s not magic — it works by creating a calorie deficit. Drink water, black coffee, or tea during your fasting window.' },
  { keywords: ['warm up', 'warmup', 'before workout', 'cool down'], response: '🔥 Never skip the warm-up! 5–10 min of dynamic stretching (leg swings, arm circles, light cardio) reduces injury risk by up to 50%. Cool down with static stretches to aid recovery and flexibility.' },
  { keywords: ['overtraining', 'too much', 'over training', 'burnout'], response: '⚠️ Signs of overtraining: persistent fatigue, declining performance, irritability, poor sleep. The fix: take a deload week (50% volume), sleep more, and eat at maintenance. More is not always better — recovery is where progress is made.' },
  { keywords: ['cheat meal', 'cheat day', 'refeed'], response: '🍕 A planned cheat meal (not day!) once a week can boost leptin levels and keep you mentally sane. Keep it to one meal, not an entire day of overeating. This keeps you in a calorie deficit over the week.' },
  { keywords: ['steps', 'walking', 'daily steps', '10000'], response: '🚶 Walking is underrated! 10,000 steps burns an extra 400–500 kcal daily without taxing your recovery. Use a pedometer or phone, take stairs, park further away, and walk during calls.' },
  { keywords: ['heart rate', 'bpm', 'zone', 'target heart rate'], response: '❤️ Training zones: Zone 1 (50-60% max HR) = recovery. Zone 2 (60-70%) = fat burn & aerobic base. Zone 3 (70-80%) = aerobic threshold. Zone 4 (80-90%) = lactate threshold. Zone 5 (90-100%) = max effort (HIIT).' },
  { keywords: ['how long', 'results', 'when will', 'how soon'], response: '⏳ Realistic timelines: you\'ll feel stronger in 2–4 weeks, see muscle changes in 6–8 weeks, and significant body composition changes in 12–16 weeks. Consistency is everything — trust the process!' },
  { keywords: ['back pain', 'lower back', 'back hurt'], response: '🦴 Many back issues come from weak glutes and tight hip flexors. Strengthen with glute bridges and hip thrusts. Stretch hip flexors daily. See a physiotherapist if pain persists. Avoid heavy spinal loading with poor form!' },
  { keywords: ['plateau', 'stuck', 'not losing', 'no progress'], response: '📊 Hit a plateau? Try: changing your workout (new exercises, rep ranges), recalculating your calorie target (your TDEE drops as you lose weight), sleeping more, or taking a diet break. Your body adapts — you must adapt too!' },
];

const SUGGESTIONS = [
  'How many calories should I eat?',
  'Best exercises for beginners?',
  'How much protein do I need?',
  'How to lose weight faster?',
  'Why is sleep important for fitness?',
  'What is Zone 2 cardio?',
  'How do I break a plateau?',
  'Should I take creatine?',
];

// ── Calorie calc ──────────────────────────────────────────────────────────────
function calculateTDEE(user, goal) {
  const weight = +(user.weight_kg || 70);
  const height = +(user.height_cm || 170);
  const age = +(user.age || 25);
  const gender = user.gender || 'male';

  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = bmr * 1.55; // moderate activity
  if (goal === 'weight_loss') return Math.round(tdee - 500);
  if (goal === 'muscle_gain') return Math.round(tdee + 300);
  return Math.round(tdee);
}

function getMacros(calories, goal) {
  let pPct, cPct, fPct;
  if (goal === 'weight_loss') { pPct = 0.35; cPct = 0.40; fPct = 0.25; }
  else if (goal === 'muscle_gain') { pPct = 0.30; cPct = 0.50; fPct = 0.20; }
  else { pPct = 0.25; cPct = 0.50; fPct = 0.25; }
  return {
    protein: Math.round((calories * pPct) / 4),
    carbs:   Math.round((calories * cPct) / 4),
    fat:     Math.round((calories * fPct) / 9),
  };
}

// ── Goal selection ────────────────────────────────────────────────────────────
function selectGoal(goal) {
  selectedGoal = goal;

  // Highlight selected card
  document.querySelectorAll('.goal-selector-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`.goal-selector-card.${goal}`).classList.add('selected');

  // Generate and show plan
  generatePlan(goal);
  addChatMessage('ai', `Great choice! I've generated your personalised **${goal.replace('_', ' ')}** plan above. Select a goal workout to see the full week schedule, calorie targets, and macros. Feel free to ask me anything! 💪`);
}

function generatePlan(goal) {
  const user = getUser();
  const plan = PLANS[goal];
  const calories = calculateTDEE(user, goal);
  const macros = getMacros(calories, goal);
  const goalLabels = { weight_loss: '🔥 Weight Loss Plan', muscle_gain: '💪 Muscle Gain Plan', maintenance: '⚖️ Maintenance Plan' };
  const goalColors = { weight_loss: 'var(--accent-red)', muscle_gain: 'var(--accent-purple)', maintenance: 'var(--accent-green)' };

  document.getElementById('planTitle').textContent = goalLabels[goal];
  document.getElementById('planSection').classList.add('visible');

  // Badges
  document.getElementById('planBadges').innerHTML = `
    <span class="plan-badge" style="background:rgba(124,58,237,0.15);color:var(--accent-purple)">${calories.toLocaleString()} kcal/day</span>
    <span class="plan-badge" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan)">${plan.schedule.filter(d => !d.rest).length} training days</span>`;

  // Nutrition
  document.getElementById('nutritionRow').innerHTML = `
    <div class="nutri-card">
      <div class="nutri-icon">🔥</div>
      <div class="nutri-value">${calories.toLocaleString()}</div>
      <div class="nutri-unit">kcal</div>
      <div class="nutri-label">Daily Calories</div>
    </div>
    <div class="nutri-card">
      <div class="nutri-icon">🥩</div>
      <div class="nutri-value">${macros.protein}g</div>
      <div class="nutri-unit">protein</div>
      <div class="nutri-label">Protein</div>
    </div>
    <div class="nutri-card">
      <div class="nutri-icon">🍚</div>
      <div class="nutri-value">${macros.carbs}g</div>
      <div class="nutri-unit">carbs</div>
      <div class="nutri-label">Carbohydrates</div>
    </div>
    <div class="nutri-card">
      <div class="nutri-icon">🥑</div>
      <div class="nutri-value">${macros.fat}g</div>
      <div class="nutri-unit">fat</div>
      <div class="nutri-label">Healthy Fats</div>
    </div>`;

  // Schedule
  const dayColors = { Monday: '#06b6d4', Tuesday: '#7c3aed', Wednesday: '#10b981', Thursday: '#f59e0b', Friday: '#ec4899', Saturday: '#ef4444', Sunday: '#94a3b8' };
  document.getElementById('scheduleBody').innerHTML = plan.schedule.map(day => `
    <tr class="${day.rest ? 'rest-day' : ''}">
      <td><span class="day-badge" style="background:${dayColors[day.day]}22;color:${dayColors[day.day]}">${day.day.slice(0, 3)}</span></td>
      <td style="font-weight:600;color:var(--text-primary)">${day.focus}</td>
      <td>${day.exercises}</td>
      <td style="font-weight:600">${day.duration}</td>
    </tr>`).join('');

  // Tips
  document.getElementById('planTipsGrid').innerHTML = plan.tips.map(t => `
    <div class="tip-item">
      <span class="tip-icon">${t.icon}</span>
      <span class="tip-text">${t.text}</span>
    </div>`).join('');
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function addChatMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `msg ${role === 'user' ? 'user-msg' : 'ai-msg'}`;

  // Simple bold markdown support
  const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  div.innerHTML = `
    ${role === 'ai' ? '<div class="ai-avatar" style="width:32px;height:32px;font-size:14px">🤖</div>' : ''}
    <div>
      <div class="msg-bubble">${formatted}</div>
      <div class="msg-time">${now}</div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function getBotResponse(input) {
  const lower = input.toLowerCase();
  for (const qa of QA_PATTERNS) {
    if (qa.keywords.some(kw => lower.includes(kw))) {
      return qa.response;
    }
  }
  // Fallback
  return "🤔 I'm still learning! Try asking about workouts, nutrition, sleep, calories, or your specific fitness goals. You can also pick a goal card above for a personalised plan!";
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  addChatMessage('user', text);
  input.value = '';

  // Simulate typing delay
  setTimeout(() => {
    const response = getBotResponse(text);
    addChatMessage('ai', response);
  }, 500 + Math.random() * 600);
}

function askSuggestion(text) {
  document.getElementById('chatInput').value = text;
  sendMessage();
}

// ── Daily tips carousel ───────────────────────────────────────────────────────
function buildTipsCarousel() {
  const carousel = document.getElementById('tipCarousel');
  const dots = document.getElementById('tipDots');

  carousel.innerHTML = DAILY_TIPS.map((tip, i) => `
    <div class="tip-slide ${i === 0 ? 'active' : ''}">
      <div class="tip-slide-content">
        <div class="tip-slide-icon">${tip.icon}</div>
        <div class="tip-slide-text">${tip.text}</div>
        <span class="tip-slide-tag">${tip.tag}</span>
      </div>
    </div>`).join('');

  dots.innerHTML = DAILY_TIPS.map((_, i) => `
    <div class="tip-dot ${i === 0 ? 'active' : ''}" onclick="goToTip(${i})"></div>`).join('');

  // Start rotation
  const dayIndex = new Date().getDate() % DAILY_TIPS.length;
  goToTip(dayIndex);
  tipTimer = setInterval(nextTip, 30000);
}

function goToTip(index) {
  currentTip = index;
  document.querySelectorAll('.tip-slide').forEach((s, i) => s.classList.toggle('active', i === index));
  document.querySelectorAll('.tip-dot').forEach((d, i) => d.classList.toggle('active', i === index));
}

function nextTip() {
  goToTip((currentTip + 1) % DAILY_TIPS.length);
}

// ── Recommendations from user data ───────────────────────────────────────────
async function loadRecommendations() {
  const container = document.getElementById('recsContainer');
  try {
    const [logsRes, workoutsRes] = await Promise.allSettled([
      apiCall('/daily-logs'),
      apiCall('/workouts'),
    ]);

    const logs = logsRes.status === 'fulfilled'
      ? (Array.isArray(logsRes.value.logs) ? logsRes.value.logs : logsRes.value)
      : [];
    const workouts = workoutsRes.status === 'fulfilled'
      ? (Array.isArray(workoutsRes.value.workouts) ? workoutsRes.value.workouts : workoutsRes.value)
      : [];

    // Last 7 days
    const recent = logs.slice(0, 7);
    const recs = [];

    const avgSteps = recent.length ? Math.round(recent.reduce((a, l) => a + +(l.steps || 0), 0) / recent.length) : 0;
    const avgSleep = recent.length ? (recent.reduce((a, l) => a + +(l.sleep_hours || 0), 0) / recent.length).toFixed(1) : 0;
    const avgWater = recent.length ? Math.round(recent.reduce((a, l) => a + +(l.water_ml || 0), 0) / recent.length) : 0;
    const recentWorkouts = workouts.filter(w => new Date(w.workout_date || w.created_at) >= new Date(Date.now() - 7 * 86400000));

    if (avgSteps < 6000) recs.push({ icon: '🚶', bg: 'rgba(6,182,212,0.12)', title: 'Increase Daily Steps', desc: `Your avg is ${avgSteps.toLocaleString()}/day. Try to reach 8,000+!`, priority: 'high' });
    if (+avgSleep < 7) recs.push({ icon: '😴', bg: 'rgba(124,58,237,0.12)', title: 'Improve Sleep Duration', desc: `You're averaging ${avgSleep}h. Aim for 7–9 hours nightly.`, priority: 'high' });
    if (avgWater < 1500) recs.push({ icon: '💧', bg: 'rgba(59,130,246,0.12)', title: 'Drink More Water', desc: `${avgWater}ml avg. Target at least 2,000ml daily.`, priority: 'med' });
    if (recentWorkouts.length < 3) recs.push({ icon: '🏋️', bg: 'rgba(245,158,11,0.12)', title: 'Increase Workout Frequency', desc: `${recentWorkouts.length} workouts this week. Aim for 3–4.`, priority: 'med' });
    if (recs.length === 0) recs.push({ icon: '🌟', bg: 'rgba(16,185,129,0.12)', title: 'Excellent Progress!', desc: 'Your stats are looking great. Keep maintaining this healthy lifestyle!', priority: 'low' });

    container.innerHTML = recs.slice(0, 4).map(r => `
      <div class="rec-item">
        <div class="rec-icon" style="background:${r.bg}">${r.icon}</div>
        <div class="rec-content">
          <div class="rec-title">${r.title}</div>
          <div class="rec-desc">${r.desc}</div>
          <div class="rec-priority priority-${r.priority}">${r.priority.toUpperCase()}</div>
        </div>
      </div>`).join('');

  } catch (err) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)">Log more data to get personalised recommendations!</div>`;
  }
}

// ── Suggestions chips ─────────────────────────────────────────────────────────
function buildSuggestions() {
  const el = document.getElementById('suggestions');
  el.innerHTML = SUGGESTIONS.slice(0, 4).map(s =>
    `<button class="sugg-chip" onclick="askSuggestion('${s}')">${s}</button>`
  ).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  const el = document.getElementById('userAvatar');
  if (el && user.name) el.textContent = user.name.charAt(0).toUpperCase();

  // Initial AI greeting
  addChatMessage('ai', `Hey${user.name ? ', ' + user.name.split(' ')[0] : ''}! 👋 I'm your FitTrack AI Coach. Select a goal card above to get your personalised workout plan, or ask me anything about fitness, nutrition, or recovery!`);

  buildSuggestions();
  buildTipsCarousel();
  loadRecommendations();
});
