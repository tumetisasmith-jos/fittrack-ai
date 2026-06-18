const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../fittrack.db');

let db;

function getDB() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const database = getDB();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      height_cm REAL DEFAULT 170,
      weight_kg REAL DEFAULT 70,
      age INTEGER DEFAULT 25,
      gender TEXT DEFAULT 'other',
      role TEXT DEFAULT 'user',
      xp_points INTEGER DEFAULT 0,
      level TEXT DEFAULT 'Beginner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      calories_burned INTEGER NOT NULL,
      notes TEXT,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      steps INTEGER DEFAULT 0,
      water_ml REAL DEFAULT 0,
      sleep_hours REAL DEFAULT 0,
      calories_burned INTEGER DEFAULT 0,
      mood INTEGER DEFAULT 3,
      energy_level INTEGER DEFAULT 3,
      weight_kg REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      target_value REAL NOT NULL,
      current_value REAL DEFAULT 0,
      unit TEXT NOT NULL,
      deadline DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bmi_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      weight_kg REAL NOT NULL,
      height_cm REAL NOT NULL,
      bmi REAL NOT NULL,
      category TEXT NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      badge_key TEXT NOT NULL,
      badge_name TEXT NOT NULL,
      badge_icon TEXT NOT NULL,
      xp_awarded INTEGER DEFAULT 50,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, badge_key)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date DATE NOT NULL,
      meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
      food_name TEXT NOT NULL,
      quantity_g REAL DEFAULT 100,
      calories INTEGER DEFAULT 0,
      protein_g REAL DEFAULT 0,
      carbs_g REAL DEFAULT 0,
      fat_g REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      muscle_groups TEXT,
      difficulty TEXT DEFAULT 'beginner' CHECK(difficulty IN ('beginner','intermediate','advanced')),
      calories_per_minute REAL DEFAULT 5,
      equipment TEXT DEFAULT 'none',
      instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      workout_type TEXT NOT NULL,
      scheduled_date DATE NOT NULL,
      scheduled_time TEXT DEFAULT '07:00',
      duration_minutes INTEGER DEFAULT 30,
      notes TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','completed','skipped')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS heart_rate_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bpm INTEGER NOT NULL,
      context TEXT DEFAULT 'resting' CHECK(context IN ('resting','active','post-workout','sleeping')),
      notes TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    seedDatabase(database);
  }
}

function calcBMICategory(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function calcLevel(xp) {
  if (xp >= 2000) return 'Elite';
  if (xp >= 1000) return 'Platinum';
  if (xp >= 600) return 'Gold';
  if (xp >= 300) return 'Silver';
  if (xp >= 100) return 'Bronze';
  return 'Beginner';
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function dateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function seedDatabase(database) {
  console.log('🌱 Seeding database with demo data...');

  const workoutTypes = ['Running', 'Cycling', 'Yoga', 'Strength Training', 'Swimming', 'HIIT', 'Walking', 'Pilates', 'Boxing', 'Basketball'];

  const BADGES = {
    first_workout: { name: '🏃 First Workout', icon: '🏃', xp: 50 },
    streak_7: { name: '🔥 7-Day Streak', icon: '🔥', xp: 100 },
    streak_30: { name: '💫 30-Day Streak', icon: '💫', xp: 300 },
    hydration_master: { name: '💧 Hydration Master', icon: '💧', xp: 75 },
    goal_crusher: { name: '🎯 Goal Crusher', icon: '🎯', xp: 100 },
    step_master: { name: '👟 Step Master', icon: '👟', xp: 75 },
    iron_will: { name: '💪 Iron Will', icon: '💪', xp: 150 }
  };

  const userProfiles = [
    { full_name: 'Admin User', username: 'admin', email: 'admin@fittrack.ai', password: 'admin123', role: 'admin', age: 30, gender: 'male', height_cm: 178, weight_kg: 75 },
    { full_name: 'Demo User', username: 'demo', email: 'demo@fittrack.ai', password: 'demo123', role: 'user', age: 28, gender: 'female', height_cm: 165, weight_kg: 62 },
    { full_name: 'James Carter', username: 'jcarter', email: 'james.carter@email.com', password: 'pass123', role: 'user', age: 34, gender: 'male', height_cm: 182, weight_kg: 84 },
    { full_name: 'Sophia Lee', username: 'sophialee', email: 'sophia.lee@email.com', password: 'pass123', role: 'user', age: 26, gender: 'female', height_cm: 162, weight_kg: 57 },
    { full_name: 'Marcus Williams', username: 'marcusw', email: 'marcus.williams@email.com', password: 'pass123', role: 'user', age: 41, gender: 'male', height_cm: 188, weight_kg: 92 },
    { full_name: 'Priya Sharma', username: 'priyasharma', email: 'priya.sharma@email.com', password: 'pass123', role: 'user', age: 29, gender: 'female', height_cm: 160, weight_kg: 55 },
    { full_name: 'Ethan Brown', username: 'ethanbrown', email: 'ethan.brown@email.com', password: 'pass123', role: 'user', age: 22, gender: 'male', height_cm: 175, weight_kg: 70 },
    { full_name: 'Aisha Okonkwo', username: 'aishao', email: 'aisha.okonkwo@email.com', password: 'pass123', role: 'user', age: 33, gender: 'female', height_cm: 168, weight_kg: 65 },
    { full_name: 'Luca Ferrari', username: 'lucaf', email: 'luca.ferrari@email.com', password: 'pass123', role: 'user', age: 38, gender: 'male', height_cm: 180, weight_kg: 79 },
    { full_name: 'Yuna Kim', username: 'yunakim', email: 'yuna.kim@email.com', password: 'pass123', role: 'user', age: 24, gender: 'female', height_cm: 158, weight_kg: 52 },
    { full_name: 'David Osei', username: 'davidosei', email: 'david.osei@email.com', password: 'pass123', role: 'user', age: 45, gender: 'male', height_cm: 185, weight_kg: 88 },
    { full_name: 'Camille Dupont', username: 'camilled', email: 'camille.dupont@email.com', password: 'pass123', role: 'user', age: 31, gender: 'female', height_cm: 167, weight_kg: 61 },
    { full_name: 'Ryan O\'Brien', username: 'ryano', email: 'ryan.obrien@email.com', password: 'pass123', role: 'user', age: 27, gender: 'male', height_cm: 177, weight_kg: 73 },
    { full_name: 'Fatima Al-Rashid', username: 'fatimar', email: 'fatima.alrashid@email.com', password: 'pass123', role: 'user', age: 35, gender: 'female', height_cm: 163, weight_kg: 59 },
    { full_name: 'Noah Jensen', username: 'noahj', email: 'noah.jensen@email.com', password: 'pass123', role: 'user', age: 19, gender: 'male', height_cm: 183, weight_kg: 76 },
    { full_name: 'Isabella Cruz', username: 'isabellacruz', email: 'isabella.cruz@email.com', password: 'pass123', role: 'user', age: 28, gender: 'female', height_cm: 170, weight_kg: 64 },
    { full_name: 'Kevin Park', username: 'kevinpark', email: 'kevin.park@email.com', password: 'pass123', role: 'user', age: 37, gender: 'male', height_cm: 172, weight_kg: 68 },
    { full_name: 'Zara Ahmed', username: 'zaraahmed', email: 'zara.ahmed@email.com', password: 'pass123', role: 'user', age: 23, gender: 'female', height_cm: 156, weight_kg: 50 },
    { full_name: 'Daniel Müller', username: 'danielm', email: 'daniel.muller@email.com', password: 'pass123', role: 'user', age: 42, gender: 'male', height_cm: 179, weight_kg: 82 },
    { full_name: 'Grace Thompson', username: 'gracet', email: 'grace.thompson@email.com', password: 'pass123', role: 'user', age: 30, gender: 'female', height_cm: 164, weight_kg: 58 },
    { full_name: 'Samuel Nguyen', username: 'samuelng', email: 'samuel.nguyen@email.com', password: 'pass123', role: 'user', age: 25, gender: 'male', height_cm: 171, weight_kg: 67 },
    { full_name: 'Leila Hosseini', username: 'leilah', email: 'leila.hosseini@email.com', password: 'pass123', role: 'user', age: 32, gender: 'female', height_cm: 166, weight_kg: 60 },
    { full_name: 'Tom Mitchell', username: 'tommitch', email: 'tom.mitchell@email.com', password: 'pass123', role: 'user', age: 48, gender: 'male', height_cm: 176, weight_kg: 86 },
    { full_name: 'Amara Diallo', username: 'amarad', email: 'amara.diallo@email.com', password: 'pass123', role: 'user', age: 21, gender: 'female', height_cm: 171, weight_kg: 63 },
    { full_name: 'Chris Evans', username: 'chrisevans', email: 'chris.evans@email.com', password: 'pass123', role: 'user', age: 36, gender: 'male', height_cm: 186, weight_kg: 91 },
    { full_name: 'Elena Popescu', username: 'elenap', email: 'elena.popescu@email.com', password: 'pass123', role: 'user', age: 27, gender: 'female', height_cm: 169, weight_kg: 62 },
    { full_name: 'Raj Patel', username: 'rajpatel', email: 'raj.patel@email.com', password: 'pass123', role: 'user', age: 39, gender: 'male', height_cm: 174, weight_kg: 74 },
    { full_name: 'Nadia Kowalski', username: 'nadiak', email: 'nadia.kowalski@email.com', password: 'pass123', role: 'user', age: 29, gender: 'female', height_cm: 161, weight_kg: 56 },
    { full_name: 'Oliver Smith', username: 'olivers', email: 'oliver.smith@email.com', password: 'pass123', role: 'user', age: 44, gender: 'male', height_cm: 181, weight_kg: 88 },
    { full_name: 'Mei Chen', username: 'meichen', email: 'mei.chen@email.com', password: 'pass123', role: 'user', age: 26, gender: 'female', height_cm: 157, weight_kg: 51 },
    { full_name: 'Aaron Johnson', username: 'aaronj', email: 'aaron.johnson@email.com', password: 'pass123', role: 'user', age: 20, gender: 'male', height_cm: 184, weight_kg: 78 },
    { full_name: 'Sara Eriksson', username: 'sarae', email: 'sara.eriksson@email.com', password: 'pass123', role: 'user', age: 34, gender: 'female', height_cm: 173, weight_kg: 66 },
    { full_name: 'Diego Hernandez', username: 'diegoh', email: 'diego.hernandez@email.com', password: 'pass123', role: 'user', age: 31, gender: 'male', height_cm: 178, weight_kg: 76 },
    { full_name: 'Alyssa Turner', username: 'alyssat', email: 'alyssa.turner@email.com', password: 'pass123', role: 'user', age: 22, gender: 'female', height_cm: 165, weight_kg: 59 },
    { full_name: 'Hassan Al-Farsi', username: 'hassanf', email: 'hassan.alfarsi@email.com', password: 'pass123', role: 'user', age: 40, gender: 'male', height_cm: 183, weight_kg: 85 },
    { full_name: 'Chloe Martin', username: 'chloem', email: 'chloe.martin@email.com', password: 'pass123', role: 'user', age: 25, gender: 'female', height_cm: 162, weight_kg: 54 },
    { full_name: 'Victor Santos', username: 'victors', email: 'victor.santos@email.com', password: 'pass123', role: 'user', age: 33, gender: 'male', height_cm: 177, weight_kg: 72 },
    { full_name: 'Yuki Tanaka', username: 'yukitanaka', email: 'yuki.tanaka@email.com', password: 'pass123', role: 'user', age: 28, gender: 'female', height_cm: 155, weight_kg: 48 },
    { full_name: 'Patrick O\'Sullivan', username: 'patricks', email: 'patrick.osullivan@email.com', password: 'pass123', role: 'user', age: 52, gender: 'male', height_cm: 175, weight_kg: 90 },
    { full_name: 'Bianca Rossi', username: 'biancar', email: 'bianca.rossi@email.com', password: 'pass123', role: 'user', age: 30, gender: 'female', height_cm: 168, weight_kg: 61 },
    { full_name: 'Mohamed Ibrahim', username: 'mohamedi', email: 'mohamed.ibrahim@email.com', password: 'pass123', role: 'user', age: 37, gender: 'male', height_cm: 180, weight_kg: 78 },
    { full_name: 'Nia Williams', username: 'niaw', email: 'nia.williams@email.com', password: 'pass123', role: 'user', age: 24, gender: 'female', height_cm: 172, weight_kg: 65 },
    { full_name: 'Aleksei Volkov', username: 'alekseiv', email: 'aleksei.volkov@email.com', password: 'pass123', role: 'user', age: 43, gender: 'male', height_cm: 185, weight_kg: 93 },
    { full_name: 'Luna Garcia', username: 'lunag', email: 'luna.garcia@email.com', password: 'pass123', role: 'user', age: 18, gender: 'female', height_cm: 160, weight_kg: 55 },
    { full_name: 'Ben Clarke', username: 'benc', email: 'ben.clarke@email.com', password: 'pass123', role: 'user', age: 46, gender: 'male', height_cm: 179, weight_kg: 84 },
    { full_name: 'Anjali Mehta', username: 'anjalim', email: 'anjali.mehta@email.com', password: 'pass123', role: 'user', age: 32, gender: 'female', height_cm: 158, weight_kg: 53 },
    { full_name: 'Jordan Taylor', username: 'jordant', email: 'jordan.taylor@email.com', password: 'pass123', role: 'user', age: 27, gender: 'other', height_cm: 170, weight_kg: 68 },
    { full_name: 'Nina Petrov', username: 'ninap', email: 'nina.petrov@email.com', password: 'pass123', role: 'user', age: 35, gender: 'female', height_cm: 167, weight_kg: 62 },
    { full_name: 'Caleb Anderson', username: 'caleba', email: 'caleb.anderson@email.com', password: 'pass123', role: 'user', age: 21, gender: 'male', height_cm: 186, weight_kg: 80 },
    { full_name: 'Freya Hansen', username: 'freyah', email: 'freya.hansen@email.com', password: 'pass123', role: 'user', age: 29, gender: 'female', height_cm: 171, weight_kg: 64 }
  ];

  const insertUser = database.prepare(`
    INSERT INTO users (full_name, username, email, password_hash, height_cm, weight_kg, age, gender, role, xp_points, level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertWorkout = database.prepare(`
    INSERT INTO workouts (user_id, type, duration_minutes, calories_burned, notes, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertLog = database.prepare(`
    INSERT OR IGNORE INTO daily_logs (user_id, date, steps, water_ml, sleep_hours, calories_burned, mood, energy_level, weight_kg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertGoal = database.prepare(`
    INSERT INTO goals (user_id, type, target_value, current_value, unit, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBMI = database.prepare(`
    INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, category)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAchievement = database.prepare(`
    INSERT OR IGNORE INTO achievements (user_id, badge_key, badge_name, badge_icon, xp_awarded)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertNotification = database.prepare(`
    INSERT INTO notifications (user_id, type, title, message, is_read)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateUserXP = database.prepare(`UPDATE users SET xp_points = ?, level = ? WHERE id = ?`);

  const workoutNotes = [
    'Felt great today!', 'Tough session but worth it', 'Personal best!', 'Easy recovery session',
    'Pushed through the wall', 'Great cardio day', 'Legs feeling heavy but kept going',
    'Morning workout - energized all day', 'Evening session after work', 'Weekend warrior mode',
    'Tried a new route', 'Group class was fun', 'Solo training day', 'Beat my previous time',
    null, null, null
  ];

  const goalTemplates = [
    { type: 'weight_loss', target_value: 5, unit: 'kg', offset: 90 },
    { type: 'steps_daily', target_value: 10000, unit: 'steps', offset: 60 },
    { type: 'water_intake', target_value: 2500, unit: 'ml', offset: 30 },
    { type: 'workouts_weekly', target_value: 4, unit: 'workouts', offset: 60 },
    { type: 'sleep_hours', target_value: 8, unit: 'hours', offset: 30 },
    { type: 'calories_burned', target_value: 500, unit: 'kcal', offset: 60 },
    { type: 'weight_gain', target_value: 3, unit: 'kg', offset: 90 }
  ];

  database.exec('BEGIN TRANSACTION');
  try {
    for (const profile of userProfiles) {
      const hash = bcrypt.hashSync(profile.password, 10);
      const bmi = parseFloat((profile.weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1));
      const xp = randomInt(0, 1800);
      const level = calcLevel(xp);

      const result = insertUser.run(
        profile.full_name,
        profile.username,
        profile.email,
        hash,
        profile.height_cm,
        profile.weight_kg,
        profile.age,
        profile.gender,
        profile.role,
        xp,
        level
      );
      const userId = result.lastInsertRowid;

      // BMI record
      const category = calcBMICategory(bmi);
      insertBMI.run(userId, profile.weight_kg, profile.height_cm, bmi, category);

      // Daily logs for last 30 days
      const baseWeight = profile.weight_kg;
      const weightTrend = Math.random() > 0.5 ? -0.05 : 0.05;
      for (let d = 30; d >= 0; d--) {
        const dateStr = dateOffset(d);
        const dayOfWeek = new Date(dateStr).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const steps = isWeekend ? randomInt(3000, 8000) : randomInt(5000, 12000);
        const water = randomInt(1500, 3500);
        const sleep = randomFloat(5.5, 8.5);
        const calories = randomInt(300, 800);
        const mood = randomInt(2, 5);
        const energy = Math.max(1, Math.min(5, mood + randomInt(-1, 1)));
        const logWeight = parseFloat((baseWeight + (weightTrend * (30 - d))).toFixed(1));

        insertLog.run(userId, dateStr, steps, water, sleep, calories, mood, energy, logWeight);
      }

      // Workouts - 6 to 15 workouts per user over 30 days
      const workoutCount = randomInt(6, 15);
      const usedDays = new Set();
      for (let w = 0; w < workoutCount; w++) {
        let day;
        do { day = randomInt(0, 29); } while (usedDays.has(day));
        usedDays.add(day);

        const type = workoutTypes[randomInt(0, workoutTypes.length - 1)];
        const duration = randomInt(20, 90);
        const caloriesMap = {
          'Running': randomInt(300, 600),
          'Cycling': randomInt(250, 500),
          'Yoga': randomInt(100, 250),
          'Strength Training': randomInt(200, 450),
          'Swimming': randomInt(300, 600),
          'HIIT': randomInt(350, 600),
          'Walking': randomInt(100, 250),
          'Pilates': randomInt(150, 300),
          'Boxing': randomInt(350, 600),
          'Basketball': randomInt(300, 500)
        };
        const burned = caloriesMap[type] || randomInt(200, 500);
        const note = workoutNotes[randomInt(0, workoutNotes.length - 1)];
        const dateStr = dateOffset(day);
        insertWorkout.run(userId, type, duration, burned, note, dateStr);
      }

      // Goals (1-3 per user)
      const numGoals = randomInt(1, 3);
      const shuffled = [...goalTemplates].sort(() => Math.random() - 0.5);
      for (let g = 0; g < numGoals; g++) {
        const tmpl = shuffled[g];
        const deadline = dateOffset(-tmpl.offset);
        const progress = randomFloat(0, tmpl.target_value * 0.9, 0);
        const status = Math.random() > 0.8 ? 'completed' : 'active';
        const currentVal = status === 'completed' ? tmpl.target_value : progress;
        insertGoal.run(userId, tmpl.type, tmpl.target_value, currentVal, tmpl.unit, deadline, status);
      }

      // Achievements (random subset)
      const badgeKeys = Object.keys(BADGES);
      const earnedCount = randomInt(1, badgeKeys.length);
      const shuffledBadges = [...badgeKeys].sort(() => Math.random() - 0.5);
      for (let b = 0; b < earnedCount; b++) {
        const key = shuffledBadges[b];
        const badge = BADGES[key];
        insertAchievement.run(userId, key, badge.name, badge.icon, badge.xp);
      }

      // Notifications (2-4 per user)
      const notifTemplates = [
        { type: 'achievement', title: '🏆 Achievement Unlocked!', message: 'You earned a new badge. Keep it up!', is_read: randomInt(0, 1) },
        { type: 'goal', title: '🎯 Goal Progress Update', message: "You're making great progress on your goal!", is_read: randomInt(0, 1) },
        { type: 'reminder', title: '💧 Hydration Reminder', message: "Don't forget to log your water intake today!", is_read: 1 },
        { type: 'milestone', title: '🎉 Milestone Reached', message: 'Congratulations on reaching a new fitness milestone!', is_read: randomInt(0, 1) },
        { type: 'tip', title: '💡 Fitness Tip', message: 'Try adding interval training to boost your cardio fitness.', is_read: 1 }
      ];
      const numNotifs = randomInt(2, 4);
      for (let n = 0; n < numNotifs; n++) {
        const tmpl = notifTemplates[randomInt(0, notifTemplates.length - 1)];
        insertNotification.run(userId, tmpl.type, tmpl.title, tmpl.message, tmpl.is_read);
      }

      updateUserXP.run(xp, level, userId);
    }
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  // Seed exercise library
  seedExerciseLibrary(database);

  // Seed extended data for first 10 users (demo + admin + 8 regular)
  const sampleUsers = database.prepare('SELECT id FROM users LIMIT 10').all();
  seedMeals(database, sampleUsers.map(u => u.id));
  seedHeartRate(database, sampleUsers.map(u => u.id));
  seedSchedules(database, sampleUsers.map(u => u.id));

  console.log('✅ Database seeded successfully with 50 users, workouts, logs, goals, achievements, notifications, exercises, meals, heart-rate logs, and schedules!');
}

function seedExerciseLibrary(database) {
  const count = database.prepare('SELECT COUNT(*) as c FROM exercises').get();
  if (count.c > 0) return;

  const exercises = [
    // Cardio
    { name: 'Running', category: 'Cardio', description: 'Outdoor or treadmill running at moderate pace', muscle_groups: 'Legs, Core, Cardiovascular', difficulty: 'beginner', calories_per_minute: 10, equipment: 'none', instructions: 'Maintain upright posture. Land mid-foot. Breathe rhythmically.' },
    { name: 'Jump Rope', category: 'Cardio', description: 'High-intensity skipping rope exercise', muscle_groups: 'Calves, Shoulders, Core', difficulty: 'beginner', calories_per_minute: 12, equipment: 'jump rope', instructions: 'Keep elbows close to sides. Jump 1-2 inches off ground. Stay on balls of feet.' },
    { name: 'Cycling', category: 'Cardio', description: 'Stationary or outdoor cycling', muscle_groups: 'Quads, Hamstrings, Glutes', difficulty: 'beginner', calories_per_minute: 8, equipment: 'bicycle', instructions: 'Adjust seat height. Keep back straight. Pedal in smooth circles.' },
    { name: 'Swimming', category: 'Cardio', description: 'Full-body low-impact swimming', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 9, equipment: 'pool', instructions: 'Breathe on every 3rd stroke. Rotate hips. Keep head neutral.' },
    { name: 'Rowing Machine', category: 'Cardio', description: 'Full body rowing on a machine', muscle_groups: 'Back, Arms, Legs, Core', difficulty: 'intermediate', calories_per_minute: 10, equipment: 'rowing machine', instructions: 'Drive with legs first, then lean back, then pull arms. Reverse on return.' },
    { name: 'Stair Climbing', category: 'Cardio', description: 'Step machine or actual stairs', muscle_groups: 'Glutes, Quads, Calves', difficulty: 'beginner', calories_per_minute: 9, equipment: 'stairs/machine', instructions: 'Push through heel. Keep upright. Do not lean on rails.' },
    { name: 'Elliptical Trainer', category: 'Cardio', description: 'Low-impact full-body cardio machine', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 8, equipment: 'elliptical', instructions: 'Keep stride smooth. Engage core. Use arm handles for upper body.' },
    { name: 'Burpees', category: 'Cardio', description: 'Full-body explosive movement', muscle_groups: 'Full Body', difficulty: 'intermediate', calories_per_minute: 13, equipment: 'none', instructions: 'Squat, kick feet back, do push-up, jump feet forward, jump up with arms overhead.' },
    { name: 'Box Jumps', category: 'Cardio', description: 'Jump onto a raised platform', muscle_groups: 'Quads, Glutes, Calves', difficulty: 'intermediate', calories_per_minute: 11, equipment: 'box/platform', instructions: 'Start in athletic stance. Swing arms. Land softly with bent knees.' },
    { name: 'Walking', category: 'Cardio', description: 'Brisk walking for cardiovascular health', muscle_groups: 'Legs, Core', difficulty: 'beginner', calories_per_minute: 4, equipment: 'none', instructions: 'Walk at brisk pace. Swing arms naturally. Keep posture tall.' },
    // Strength
    { name: 'Push-Ups', category: 'Strength', description: 'Classic bodyweight chest exercise', muscle_groups: 'Chest, Shoulders, Triceps, Core', difficulty: 'beginner', calories_per_minute: 6, equipment: 'none', instructions: 'Keep body in straight line. Lower chest to floor. Fully extend arms.' },
    { name: 'Pull-Ups', category: 'Strength', description: 'Upper body pulling exercise', muscle_groups: 'Back, Biceps, Core', difficulty: 'intermediate', calories_per_minute: 7, equipment: 'pull-up bar', instructions: 'Hang with full arm extension. Pull chin above bar. Control the descent.' },
    { name: 'Squats', category: 'Strength', description: 'Fundamental lower body exercise', muscle_groups: 'Quads, Hamstrings, Glutes, Core', difficulty: 'beginner', calories_per_minute: 6, equipment: 'none', instructions: 'Feet shoulder-width. Lower until thighs parallel to floor. Drive through heels.' },
    { name: 'Deadlift', category: 'Strength', description: 'Full body compound strength lift', muscle_groups: 'Back, Glutes, Hamstrings, Core', difficulty: 'intermediate', calories_per_minute: 7, equipment: 'barbell', instructions: 'Bar over mid-foot. Neutral spine. Drive floor away. Lock hips at top.' },
    { name: 'Bench Press', category: 'Strength', description: 'Barbell or dumbbell chest press', muscle_groups: 'Chest, Shoulders, Triceps', difficulty: 'intermediate', calories_per_minute: 6, equipment: 'barbell/bench', instructions: 'Grip slightly wider than shoulders. Lower to chest. Press to full extension.' },
    { name: 'Overhead Press', category: 'Strength', description: 'Shoulder pressing movement', muscle_groups: 'Shoulders, Triceps, Core', difficulty: 'intermediate', calories_per_minute: 6, equipment: 'barbell/dumbbells', instructions: 'Press directly overhead. Keep core braced. Lower to chin level.' },
    { name: 'Lunges', category: 'Strength', description: 'Single-leg strength exercise', muscle_groups: 'Quads, Glutes, Hamstrings', difficulty: 'beginner', calories_per_minute: 5, equipment: 'none', instructions: 'Step forward. Lower back knee toward floor. Keep front knee over ankle.' },
    { name: 'Plank', category: 'Strength', description: 'Core stability exercise', muscle_groups: 'Core, Shoulders, Glutes', difficulty: 'beginner', calories_per_minute: 4, equipment: 'none', instructions: 'Forearms or hands on floor. Body in straight line. Hold position. Breathe normally.' },
    { name: 'Dumbbell Rows', category: 'Strength', description: 'One-arm back strengthening exercise', muscle_groups: 'Back, Biceps, Core', difficulty: 'beginner', calories_per_minute: 5, equipment: 'dumbbell', instructions: 'Brace on bench. Pull elbow back and up. Squeeze shoulder blade at top.' },
    { name: 'Romanian Deadlift', category: 'Strength', description: 'Hip hinge for hamstrings and glutes', muscle_groups: 'Hamstrings, Glutes, Back', difficulty: 'intermediate', calories_per_minute: 6, equipment: 'barbell/dumbbells', instructions: 'Hinge at hips. Keep back flat. Lower weights along legs. Feel hamstring stretch.' },
    // HIIT
    { name: 'Tabata Intervals', category: 'HIIT', description: '20s on / 10s off high-intensity intervals', muscle_groups: 'Full Body', difficulty: 'advanced', calories_per_minute: 14, equipment: 'none', instructions: 'Go max effort for 20s. Rest 10s. Repeat 8 rounds (4 min total).' },
    { name: 'Circuit Training', category: 'HIIT', description: 'Back-to-back exercises with minimal rest', muscle_groups: 'Full Body', difficulty: 'intermediate', calories_per_minute: 11, equipment: 'varies', instructions: 'Move station to station with 10-30s rest. Complete 3-5 rounds.' },
    { name: 'Sprint Intervals', category: 'HIIT', description: 'High-speed running with recovery periods', muscle_groups: 'Legs, Core, Cardiovascular', difficulty: 'intermediate', calories_per_minute: 15, equipment: 'none', instructions: 'Sprint 30-60s at 90% effort. Walk 60-90s to recover. Repeat 6-10x.' },
    { name: 'Mountain Climbers', category: 'HIIT', description: 'Core and cardio combination exercise', muscle_groups: 'Core, Shoulders, Legs', difficulty: 'beginner', calories_per_minute: 10, equipment: 'none', instructions: 'Start in push-up position. Drive alternating knees to chest rapidly. Keep hips level.' },
    { name: 'Kettlebell Swings', category: 'HIIT', description: 'Explosive hip hinge movement', muscle_groups: 'Glutes, Hamstrings, Core, Shoulders', difficulty: 'intermediate', calories_per_minute: 13, equipment: 'kettlebell', instructions: 'Hinge at hips. Drive hips forward explosively. Swing bell to chest height.' },
    { name: 'Battle Ropes', category: 'HIIT', description: 'Rope wave exercise for full body', muscle_groups: 'Arms, Shoulders, Core, Legs', difficulty: 'intermediate', calories_per_minute: 13, equipment: 'battle ropes', instructions: 'Alternate arm waves. Keep core tight. Bend knees slightly. Maintain rhythm.' },
    // Flexibility
    { name: 'Yoga Flow', category: 'Flexibility', description: 'Dynamic sequence of yoga poses', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 3, equipment: 'yoga mat', instructions: 'Flow through Sun Salutation A and B. Link breath to movement.' },
    { name: 'Static Stretching', category: 'Flexibility', description: 'Hold stretches 30-60 seconds', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 2, equipment: 'none', instructions: 'Stretch to point of mild tension, not pain. Hold 30-60s. Breathe deeply.' },
    { name: 'Pilates', category: 'Flexibility', description: 'Core-focused controlled movement', muscle_groups: 'Core, Hips, Back', difficulty: 'beginner', calories_per_minute: 4, equipment: 'mat', instructions: 'Control all movements. Engage deep core. Breathe through movements.' },
    { name: 'Foam Rolling', category: 'Flexibility', description: 'Self-myofascial release technique', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 2, equipment: 'foam roller', instructions: 'Roll slowly over muscle. Pause on tender spots 20-30s. Avoid joints.' },
    { name: 'Hip Flexor Stretch', category: 'Flexibility', description: 'Deep hip flexor and quad stretch', muscle_groups: 'Hip Flexors, Quads', difficulty: 'beginner', calories_per_minute: 2, equipment: 'mat', instructions: 'Kneeling lunge position. Push hips forward. Reach arm up. Hold 30s each side.' },
    { name: 'Shoulder Mobility', category: 'Flexibility', description: 'Shoulder circles and stretches', muscle_groups: 'Shoulders, Upper Back', difficulty: 'beginner', calories_per_minute: 2, equipment: 'resistance band', instructions: 'Arm circles. Band pull-aparts. Cross-body shoulder stretch. Hold each 20s.' },
    // Sports
    { name: 'Basketball', category: 'Sports', description: 'Shooting, dribbling, and court play', muscle_groups: 'Full Body', difficulty: 'intermediate', calories_per_minute: 8, equipment: 'basketball, court', instructions: 'Warm up with dribbling drills. Practice shooting form. Play scrimmage.' },
    { name: 'Soccer', category: 'Sports', description: 'Field soccer drills and match play', muscle_groups: 'Legs, Core, Cardiovascular', difficulty: 'intermediate', calories_per_minute: 9, equipment: 'soccer ball', instructions: 'Dribbling and passing drills. Small-sided games. Full match.' },
    { name: 'Tennis', category: 'Sports', description: 'Racquet sport with volleys and serves', muscle_groups: 'Arms, Core, Legs', difficulty: 'intermediate', calories_per_minute: 8, equipment: 'racquet, court', instructions: 'Practice forehand and backhand groundstrokes. Work on serve motion.' },
    { name: 'Boxing', category: 'Sports', description: 'Boxing combinations and bag work', muscle_groups: 'Arms, Core, Legs, Cardiovascular', difficulty: 'intermediate', calories_per_minute: 11, equipment: 'gloves, bag', instructions: 'Jab-cross-hook-uppercut combinations. 3-min rounds, 1-min rest.' },
    { name: 'Volleyball', category: 'Sports', description: 'Serving, setting, and spiking drills', muscle_groups: 'Legs, Core, Arms', difficulty: 'beginner', calories_per_minute: 7, equipment: 'volleyball, net', instructions: 'Practice serving technique. Bump-set-spike sequences. Game play.' },
    // Recovery
    { name: 'Active Recovery Walk', category: 'Recovery', description: 'Light walking for muscle recovery', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 3, equipment: 'none', instructions: 'Walk at comfortable pace for 20-30 min. Focus on deep breathing.' },
    { name: 'Meditation', category: 'Recovery', description: 'Mindfulness and breathing exercises', muscle_groups: 'Mind, Core (breathing)', difficulty: 'beginner', calories_per_minute: 1, equipment: 'mat', instructions: 'Sit comfortably. Focus on breath. Allow thoughts to pass without judgment.' },
    { name: 'Ice Bath', category: 'Recovery', description: 'Cold water immersion for recovery', muscle_groups: 'Full Body', difficulty: 'intermediate', calories_per_minute: 1, equipment: 'ice, tub', instructions: 'Immerse in 10-15°C water for 10-15 min. Limit to post-intense training.' },
    { name: 'Contrast Therapy', category: 'Recovery', description: 'Alternating hot/cold for recovery', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 1, equipment: 'shower', instructions: '3 min hot, 1 min cold. Repeat 3-5 cycles. End with cold.' }
  ];

  const stmt = database.prepare(`
    INSERT INTO exercises (name, category, description, muscle_groups, difficulty, calories_per_minute, equipment, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ex of exercises) {
    stmt.run(ex.name, ex.category, ex.description, ex.muscle_groups, ex.difficulty, ex.calories_per_minute, ex.equipment, ex.instructions);
  }
}

function seedMeals(database, userIds) {
  const count = database.prepare('SELECT COUNT(*) as c FROM meals').get();
  if (count.c > 0) return;

  const mealTemplates = {
    breakfast: [
      { food_name: 'Oatmeal with Berries', calories: 320, protein_g: 12, carbs_g: 58, fat_g: 6 },
      { food_name: 'Scrambled Eggs & Toast', calories: 380, protein_g: 24, carbs_g: 32, fat_g: 16 },
      { food_name: 'Greek Yogurt Parfait', calories: 280, protein_g: 18, carbs_g: 40, fat_g: 5 },
      { food_name: 'Protein Smoothie', calories: 340, protein_g: 32, carbs_g: 38, fat_g: 6 },
      { food_name: 'Avocado Toast', calories: 360, protein_g: 10, carbs_g: 35, fat_g: 20 }
    ],
    lunch: [
      { food_name: 'Grilled Chicken Salad', calories: 420, protein_g: 38, carbs_g: 22, fat_g: 14 },
      { food_name: 'Quinoa Power Bowl', calories: 480, protein_g: 22, carbs_g: 62, fat_g: 12 },
      { food_name: 'Turkey Wrap', calories: 440, protein_g: 30, carbs_g: 44, fat_g: 14 },
      { food_name: 'Salmon Rice Bowl', calories: 520, protein_g: 36, carbs_g: 52, fat_g: 16 },
      { food_name: 'Lentil Soup', calories: 360, protein_g: 22, carbs_g: 54, fat_g: 4 }
    ],
    dinner: [
      { food_name: 'Baked Salmon & Veggies', calories: 520, protein_g: 42, carbs_g: 28, fat_g: 22 },
      { food_name: 'Chicken Stir-Fry', calories: 460, protein_g: 36, carbs_g: 38, fat_g: 14 },
      { food_name: 'Beef & Broccoli', calories: 540, protein_g: 40, carbs_g: 34, fat_g: 22 },
      { food_name: 'Pasta with Turkey Meatballs', calories: 620, protein_g: 38, carbs_g: 68, fat_g: 16 },
      { food_name: 'Grilled Steak & Sweet Potato', calories: 580, protein_g: 46, carbs_g: 42, fat_g: 18 }
    ],
    snack: [
      { food_name: 'Protein Bar', calories: 210, protein_g: 20, carbs_g: 24, fat_g: 6 },
      { food_name: 'Mixed Nuts', calories: 180, protein_g: 6, carbs_g: 8, fat_g: 16 },
      { food_name: 'Apple & Peanut Butter', calories: 240, protein_g: 8, carbs_g: 30, fat_g: 10 },
      { food_name: 'Cottage Cheese', calories: 160, protein_g: 22, carbs_g: 6, fat_g: 4 }
    ]
  };

  const stmt = database.prepare(`
    INSERT INTO meals (user_id, date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, quantity_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const userId of userIds) {
    for (let d = 30; d >= 0; d--) {
      const dateStr = dateOffset(d);
      const types = ['breakfast', 'lunch', 'dinner'];
      if (Math.random() > 0.4) types.push('snack');
      for (const mType of types) {
        const opts = mealTemplates[mType];
        const meal = opts[randomInt(0, opts.length - 1)];
        stmt.run(userId, dateStr, mType, meal.food_name, meal.calories, meal.protein_g, meal.carbs_g, meal.fat_g, 100);
      }
    }
  }
}

function seedHeartRate(database, userIds) {
  const count = database.prepare('SELECT COUNT(*) as c FROM heart_rate_logs').get();
  if (count.c > 0) return;

  const stmt = database.prepare(`
    INSERT INTO heart_rate_logs (user_id, bpm, context, recorded_at)
    VALUES (?, ?, ?, ?)
  `);

  const contexts = ['resting', 'active', 'post-workout', 'sleeping'];
  const bpmRanges = { resting: [55, 80], active: [110, 160], 'post-workout': [90, 130], sleeping: [45, 65] };

  for (const userId of userIds) {
    for (let d = 29; d >= 0; d--) {
      const dateStr = dateOffset(d);
      const numReadings = randomInt(1, 3);
      for (let r = 0; r < numReadings; r++) {
        const ctx = contexts[randomInt(0, contexts.length - 1)];
        const range = bpmRanges[ctx];
        const bpm = randomInt(range[0], range[1]);
        const ts  = `${dateStr} ${String(randomInt(6, 22)).padStart(2, '0')}:${String(randomInt(0, 59)).padStart(2, '0')}:00`;
        stmt.run(userId, bpm, ctx, ts);
      }
    }
  }
}

function seedSchedules(database, userIds) {
  const count = database.prepare('SELECT COUNT(*) as c FROM workout_schedules').get();
  if (count.c > 0) return;

  const stmt = database.prepare(`
    INSERT INTO workout_schedules (user_id, title, workout_type, scheduled_date, scheduled_time, duration_minutes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const workoutTypes = ['Running', 'Cycling', 'Yoga', 'Strength Training', 'Swimming', 'HIIT', 'Walking'];
  const times = ['06:00', '07:00', '08:00', '12:00', '17:00', '18:00', '19:00'];

  for (const userId of userIds) {
    for (let d = 1; d <= 7; d++) {
      if (Math.random() > 0.5) {
        const wType = workoutTypes[randomInt(0, workoutTypes.length - 1)];
        const futureDate = dateOffset(-d);
        stmt.run(userId, `${wType} Session`, wType, futureDate, times[randomInt(0, times.length - 1)], randomInt(30, 60), 'pending');
      }
    }
    // Add 2 past completed
    for (let d = 1; d <= 7; d++) {
      if (Math.random() > 0.6) {
        const wType = workoutTypes[randomInt(0, workoutTypes.length - 1)];
        stmt.run(userId, `${wType} Session`, wType, dateOffset(d), times[randomInt(0, times.length - 1)], randomInt(30, 60), 'completed');
      }
    }
  }
}

module.exports = { getDB, initializeDatabase };
