// Restore all 48 sample users with workouts, logs, goals, achievements, notifications
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'fittrack.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min, max, d = 1) { return parseFloat((Math.random() * (max - min) + min).toFixed(d)); }
function dateOffset(daysAgo) { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().split('T')[0]; }
function calcLevel(xp) {
  if (xp >= 2000) return 'Elite';
  if (xp >= 1000) return 'Platinum';
  if (xp >= 600) return 'Gold';
  if (xp >= 300) return 'Silver';
  if (xp >= 100) return 'Bronze';
  return 'Beginner';
}
function calcBMI(w, h) { return parseFloat((w / Math.pow(h / 100, 2)).toFixed(1)); }
function bmiCat(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

const users = [
  { full_name: 'James Carter',      username: 'jcarter',      email: 'james.carter@email.com',      password: 'pass123', age: 34, gender: 'male',   height_cm: 182, weight_kg: 84 },
  { full_name: 'Sophia Lee',        username: 'sophialee',    email: 'sophia.lee@email.com',        password: 'pass123', age: 26, gender: 'female', height_cm: 162, weight_kg: 57 },
  { full_name: 'Marcus Williams',   username: 'marcusw',      email: 'marcus.williams@email.com',   password: 'pass123', age: 41, gender: 'male',   height_cm: 188, weight_kg: 92 },
  { full_name: 'Priya Sharma',      username: 'priyasharma', email: 'priya.sharma@email.com',       password: 'pass123', age: 29, gender: 'female', height_cm: 160, weight_kg: 55 },
  { full_name: 'Ethan Brown',       username: 'ethanbrown',   email: 'ethan.brown@email.com',       password: 'pass123', age: 22, gender: 'male',   height_cm: 175, weight_kg: 70 },
  { full_name: 'Aisha Okonkwo',     username: 'aishao',       email: 'aisha.okonkwo@email.com',     password: 'pass123', age: 33, gender: 'female', height_cm: 168, weight_kg: 65 },
  { full_name: 'Luca Ferrari',      username: 'lucaf',        email: 'luca.ferrari@email.com',      password: 'pass123', age: 38, gender: 'male',   height_cm: 180, weight_kg: 79 },
  { full_name: 'Yuna Kim',          username: 'yunakim',      email: 'yuna.kim@email.com',          password: 'pass123', age: 24, gender: 'female', height_cm: 158, weight_kg: 52 },
  { full_name: 'David Osei',        username: 'davidosei',    email: 'david.osei@email.com',        password: 'pass123', age: 45, gender: 'male',   height_cm: 185, weight_kg: 88 },
  { full_name: 'Camille Dupont',    username: 'camilled',     email: 'camille.dupont@email.com',    password: 'pass123', age: 31, gender: 'female', height_cm: 167, weight_kg: 61 },
  { full_name: "Ryan O'Brien",      username: 'ryano',        email: 'ryan.obrien@email.com',       password: 'pass123', age: 27, gender: 'male',   height_cm: 177, weight_kg: 73 },
  { full_name: 'Fatima Al-Rashid',  username: 'fatimar',      email: 'fatima.alrashid@email.com',   password: 'pass123', age: 35, gender: 'female', height_cm: 163, weight_kg: 59 },
  { full_name: 'Noah Jensen',       username: 'noahj',        email: 'noah.jensen@email.com',       password: 'pass123', age: 19, gender: 'male',   height_cm: 183, weight_kg: 76 },
  { full_name: 'Isabella Cruz',     username: 'isabellacruz', email: 'isabella.cruz@email.com',     password: 'pass123', age: 28, gender: 'female', height_cm: 170, weight_kg: 64 },
  { full_name: 'Kevin Park',        username: 'kevinpark',    email: 'kevin.park@email.com',        password: 'pass123', age: 37, gender: 'male',   height_cm: 172, weight_kg: 68 },
  { full_name: 'Zara Ahmed',        username: 'zaraahmed',    email: 'zara.ahmed@email.com',        password: 'pass123', age: 23, gender: 'female', height_cm: 156, weight_kg: 50 },
  { full_name: 'Daniel Muller',     username: 'danielm',      email: 'daniel.muller@email.com',     password: 'pass123', age: 42, gender: 'male',   height_cm: 179, weight_kg: 82 },
  { full_name: 'Grace Thompson',    username: 'gracet',       email: 'grace.thompson@email.com',    password: 'pass123', age: 30, gender: 'female', height_cm: 164, weight_kg: 58 },
  { full_name: 'Samuel Nguyen',     username: 'samuelng',     email: 'samuel.nguyen@email.com',     password: 'pass123', age: 25, gender: 'male',   height_cm: 171, weight_kg: 67 },
  { full_name: 'Leila Hosseini',    username: 'leilah',       email: 'leila.hosseini@email.com',    password: 'pass123', age: 32, gender: 'female', height_cm: 166, weight_kg: 60 },
  { full_name: 'Tom Mitchell',      username: 'tommitch',     email: 'tom.mitchell@email.com',      password: 'pass123', age: 48, gender: 'male',   height_cm: 176, weight_kg: 86 },
  { full_name: 'Amara Diallo',      username: 'amarad',       email: 'amara.diallo@email.com',      password: 'pass123', age: 21, gender: 'female', height_cm: 171, weight_kg: 63 },
  { full_name: 'Chris Evans',       username: 'chrisevans',   email: 'chris.evans@email.com',       password: 'pass123', age: 36, gender: 'male',   height_cm: 186, weight_kg: 91 },
  { full_name: 'Elena Popescu',     username: 'elenap',       email: 'elena.popescu@email.com',     password: 'pass123', age: 27, gender: 'female', height_cm: 169, weight_kg: 62 },
  { full_name: 'Raj Patel',         username: 'rajpatel',     email: 'raj.patel@email.com',         password: 'pass123', age: 39, gender: 'male',   height_cm: 174, weight_kg: 74 },
  { full_name: 'Nadia Kowalski',    username: 'nadiak',       email: 'nadia.kowalski@email.com',    password: 'pass123', age: 29, gender: 'female', height_cm: 161, weight_kg: 56 },
  { full_name: 'Oliver Smith',      username: 'olivers',      email: 'oliver.smith@email.com',      password: 'pass123', age: 44, gender: 'male',   height_cm: 181, weight_kg: 88 },
  { full_name: 'Mei Chen',          username: 'meichen',      email: 'mei.chen@email.com',          password: 'pass123', age: 26, gender: 'female', height_cm: 157, weight_kg: 51 },
  { full_name: 'Aaron Johnson',     username: 'aaronj',       email: 'aaron.johnson@email.com',     password: 'pass123', age: 20, gender: 'male',   height_cm: 184, weight_kg: 78 },
  { full_name: 'Sara Eriksson',     username: 'sarae',        email: 'sara.eriksson@email.com',     password: 'pass123', age: 34, gender: 'female', height_cm: 173, weight_kg: 66 },
  { full_name: 'Diego Hernandez',   username: 'diegoh',       email: 'diego.hernandez@email.com',   password: 'pass123', age: 31, gender: 'male',   height_cm: 178, weight_kg: 76 },
  { full_name: 'Alyssa Turner',     username: 'alyssat',      email: 'alyssa.turner@email.com',     password: 'pass123', age: 22, gender: 'female', height_cm: 165, weight_kg: 59 },
  { full_name: 'Hassan Al-Farsi',   username: 'hassanf',      email: 'hassan.alfarsi@email.com',    password: 'pass123', age: 40, gender: 'male',   height_cm: 183, weight_kg: 85 },
  { full_name: 'Chloe Martin',      username: 'chloem',       email: 'chloe.martin@email.com',      password: 'pass123', age: 25, gender: 'female', height_cm: 162, weight_kg: 54 },
  { full_name: 'Victor Santos',     username: 'victors',      email: 'victor.santos@email.com',     password: 'pass123', age: 33, gender: 'male',   height_cm: 177, weight_kg: 72 },
  { full_name: 'Yuki Tanaka',       username: 'yukitanaka',   email: 'yuki.tanaka@email.com',       password: 'pass123', age: 28, gender: 'female', height_cm: 155, weight_kg: 48 },
  { full_name: "Patrick O'Sullivan",username: 'patricks',     email: 'patrick.osullivan@email.com', password: 'pass123', age: 52, gender: 'male',   height_cm: 175, weight_kg: 90 },
  { full_name: 'Bianca Rossi',      username: 'biancar',      email: 'bianca.rossi@email.com',      password: 'pass123', age: 30, gender: 'female', height_cm: 168, weight_kg: 61 },
  { full_name: 'Mohamed Ibrahim',   username: 'mohamedi',     email: 'mohamed.ibrahim@email.com',   password: 'pass123', age: 37, gender: 'male',   height_cm: 180, weight_kg: 78 },
  { full_name: 'Nia Williams',      username: 'niaw',         email: 'nia.williams@email.com',      password: 'pass123', age: 24, gender: 'female', height_cm: 172, weight_kg: 65 },
  { full_name: 'Aleksei Volkov',    username: 'alekseiv',     email: 'aleksei.volkov@email.com',    password: 'pass123', age: 43, gender: 'male',   height_cm: 185, weight_kg: 93 },
  { full_name: 'Luna Garcia',       username: 'lunag',        email: 'luna.garcia@email.com',       password: 'pass123', age: 18, gender: 'female', height_cm: 160, weight_kg: 55 },
  { full_name: 'Ben Clarke',        username: 'benc',         email: 'ben.clarke@email.com',        password: 'pass123', age: 46, gender: 'male',   height_cm: 179, weight_kg: 84 },
  { full_name: 'Anjali Mehta',      username: 'anjalim',      email: 'anjali.mehta@email.com',      password: 'pass123', age: 32, gender: 'female', height_cm: 158, weight_kg: 53 },
  { full_name: 'Jordan Taylor',     username: 'jordant',      email: 'jordan.taylor@email.com',     password: 'pass123', age: 27, gender: 'other',  height_cm: 170, weight_kg: 68 },
  { full_name: 'Nina Petrov',       username: 'ninap',        email: 'nina.petrov@email.com',       password: 'pass123', age: 35, gender: 'female', height_cm: 167, weight_kg: 62 },
  { full_name: 'Caleb Anderson',    username: 'caleba',       email: 'caleb.anderson@email.com',    password: 'pass123', age: 21, gender: 'male',   height_cm: 186, weight_kg: 80 },
  { full_name: 'Freya Hansen',      username: 'freyah',       email: 'freya.hansen@email.com',      password: 'pass123', age: 29, gender: 'female', height_cm: 171, weight_kg: 64 },
];

const workoutTypes = ['Running','Cycling','Yoga','Strength Training','Swimming','HIIT','Walking','Pilates','Boxing','Basketball'];
const BADGES = {
  first_workout:    { name: '🏃 First Workout',    icon: '🏃', xp: 50  },
  streak_7:         { name: '🔥 7-Day Streak',      icon: '🔥', xp: 100 },
  streak_30:        { name: '💫 30-Day Streak',     icon: '💫', xp: 300 },
  hydration_master: { name: '💧 Hydration Master',  icon: '💧', xp: 75  },
  goal_crusher:     { name: '🎯 Goal Crusher',      icon: '🎯', xp: 100 },
  step_master:      { name: '👟 Step Master',       icon: '👟', xp: 75  },
  iron_will:        { name: '💪 Iron Will',         icon: '💪', xp: 150 },
};
const goalTemplates = [
  { type: 'weight_loss',     target_value: 5,     unit: 'kg',       offset: 90 },
  { type: 'steps_daily',     target_value: 10000, unit: 'steps',    offset: 60 },
  { type: 'water_intake',    target_value: 2500,  unit: 'ml',       offset: 30 },
  { type: 'workouts_weekly', target_value: 4,     unit: 'workouts', offset: 60 },
  { type: 'sleep_hours',     target_value: 8,     unit: 'hours',    offset: 30 },
  { type: 'calories_burned', target_value: 500,   unit: 'kcal',     offset: 60 },
  { type: 'weight_gain',     target_value: 3,     unit: 'kg',       offset: 90 },
];
const notifTemplates = [
  { type: 'achievement', title: '🏆 Achievement Unlocked!', message: 'You earned a new badge. Keep it up!' },
  { type: 'goal',        title: '🎯 Goal Progress Update',  message: "You're making great progress on your goal!" },
  { type: 'reminder',    title: '💧 Hydration Reminder',    message: "Don't forget to log your water intake today!" },
  { type: 'milestone',   title: '🎉 Milestone Reached',     message: 'Congratulations on reaching a new fitness milestone!' },
  { type: 'tip',         title: '💡 Fitness Tip',           message: 'Try adding interval training to boost your cardio fitness.' },
];
const caloriesMap = {
  'Running': [300,600], 'Cycling': [250,500], 'Yoga': [100,250],
  'Strength Training': [200,450], 'Swimming': [300,600], 'HIIT': [350,600],
  'Walking': [100,250], 'Pilates': [150,300], 'Boxing': [350,600], 'Basketball': [300,500]
};

const stmtUser = db.prepare(`
  INSERT OR IGNORE INTO users (full_name, username, email, password_hash, height_cm, weight_kg, age, gender, role, xp_points, level)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', ?, ?)
`);
const stmtWorkout = db.prepare(`INSERT INTO workouts (user_id, type, duration_minutes, calories_burned, notes, date) VALUES (?, ?, ?, ?, ?, ?)`);
const stmtLog = db.prepare(`INSERT OR IGNORE INTO daily_logs (user_id, date, steps, water_ml, sleep_hours, calories_burned, mood, energy_level, weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const stmtBMI = db.prepare(`INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, category) VALUES (?, ?, ?, ?, ?)`);
const stmtGoal = db.prepare(`INSERT INTO goals (user_id, type, target_value, current_value, unit, deadline, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const stmtBadge = db.prepare(`INSERT OR IGNORE INTO achievements (user_id, badge_key, badge_name, badge_icon, xp_awarded) VALUES (?, ?, ?, ?, ?)`);
const stmtNotif = db.prepare(`INSERT INTO notifications (user_id, type, title, message, is_read) VALUES (?, ?, ?, ?, ?)`);
const stmtXP = db.prepare(`UPDATE users SET xp_points = ?, level = ? WHERE id = ?`);

let inserted = 0;
db.exec('BEGIN TRANSACTION');
try {
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    const xp = randomInt(100, 1800);
    const level = calcLevel(xp);
    const res = stmtUser.run(u.full_name, u.username, u.email, hash, u.height_cm, u.weight_kg, u.age, u.gender, xp, level);
    if (res.changes === 0) { console.log(`Skipped (already exists): ${u.email}`); continue; }
    const uid = res.lastInsertRowid;
    inserted++;

    // BMI record
    const bmi = calcBMI(u.weight_kg, u.height_cm);
    stmtBMI.run(uid, u.weight_kg, u.height_cm, bmi, bmiCat(bmi));

    // 30 days of daily logs
    const wTrend = Math.random() > 0.5 ? -0.05 : 0.05;
    for (let d = 30; d >= 0; d--) {
      const dt = dateOffset(d);
      const dow = new Date(dt).getDay();
      const isWknd = dow === 0 || dow === 6;
      const steps = isWknd ? randomInt(3000, 8000) : randomInt(5000, 12000);
      const mood = randomInt(2, 5);
      const energy = Math.max(1, Math.min(5, mood + randomInt(-1, 1)));
      stmtLog.run(uid, dt, steps, randomInt(1500, 3500), randomFloat(5.5, 8.5), randomInt(300, 800), mood, energy, parseFloat((u.weight_kg + wTrend * (30 - d)).toFixed(1)));
    }

    // 6–15 workouts over 30 days
    const usedDays = new Set();
    for (let w = 0; w < randomInt(6, 15); w++) {
      let day; do { day = randomInt(0, 29); } while (usedDays.has(day)); usedDays.add(day);
      const type = workoutTypes[randomInt(0, workoutTypes.length - 1)];
      const [lo, hi] = caloriesMap[type];
      stmtWorkout.run(uid, type, randomInt(20, 90), randomInt(lo, hi), null, dateOffset(day));
    }

    // 1–3 goals
    const shuffledGoals = [...goalTemplates].sort(() => Math.random() - 0.5);
    for (let g = 0; g < randomInt(1, 3); g++) {
      const t = shuffledGoals[g];
      const status = Math.random() > 0.8 ? 'completed' : 'active';
      stmtGoal.run(uid, t.type, t.target_value, status === 'completed' ? t.target_value : randomFloat(0, t.target_value * 0.9, 0), t.unit, dateOffset(-t.offset), status);
    }

    // Random badges
    const badgeKeys = Object.keys(BADGES);
    const shuffledBadges = [...badgeKeys].sort(() => Math.random() - 0.5);
    for (let b = 0; b < randomInt(1, badgeKeys.length); b++) {
      const key = shuffledBadges[b];
      const badge = BADGES[key];
      stmtBadge.run(uid, key, badge.name, badge.icon, badge.xp);
    }

    // 2–4 notifications
    for (let n = 0; n < randomInt(2, 4); n++) {
      const tmpl = notifTemplates[randomInt(0, notifTemplates.length - 1)];
      stmtNotif.run(uid, tmpl.type, tmpl.title, tmpl.message, randomInt(0, 1));
    }

    stmtXP.run(xp, level, uid);
  }
  db.exec('COMMIT');
  console.log(`Done! Restored ${inserted} users with workouts, logs, goals, badges, and notifications.`);
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Error:', err.message);
  process.exit(1);
}
