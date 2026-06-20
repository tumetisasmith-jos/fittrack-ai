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

  // Always ensure exercise library is populated
  seedExerciseLibrary(database);
}

function calcLevel(xp) {
  if (xp >= 2000) return 'Elite';
  if (xp >= 1000) return 'Platinum';
  if (xp >= 600) return 'Gold';
  if (xp >= 300) return 'Silver';
  if (xp >= 100) return 'Bronze';
  return 'Beginner';
}

function seedDatabase(database) {
  console.log('Creating default accounts...');

  const insertUser = database.prepare(`
    INSERT INTO users (full_name, username, email, password_hash, height_cm, weight_kg, age, gender, role, xp_points, level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const accounts = [
    { full_name: 'Admin User', username: 'admin', email: 'admin@fittrack.ai', password: 'admin123', role: 'admin', age: 30, gender: 'male',   height_cm: 178, weight_kg: 75 },
    { full_name: 'Demo User',  username: 'demo',  email: 'demo@fittrack.ai',  password: 'demo123',  role: 'user',  age: 28, gender: 'female', height_cm: 165, weight_kg: 62 }
  ];

  database.exec('BEGIN TRANSACTION');
  try {
    for (const a of accounts) {
      const hash = bcrypt.hashSync(a.password, 10);
      insertUser.run(a.full_name, a.username, a.email, hash, a.height_cm, a.weight_kg, a.age, a.gender, a.role, 0, 'Beginner');
    }
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  console.log('Default accounts created: admin@fittrack.ai / admin123  |  demo@fittrack.ai / demo123');
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
    { name: 'Ice Bath', category: 'Recovery', description: 'Cold water immersion for recovery', muscle_groups: 'Full Body', difficulty: 'intermediate', calories_per_minute: 1, equipment: 'ice, tub', instructions: 'Immerse in 10-15C water for 10-15 min. Limit to post-intense training.' },
    { name: 'Contrast Therapy', category: 'Recovery', description: 'Alternating hot/cold for recovery', muscle_groups: 'Full Body', difficulty: 'beginner', calories_per_minute: 1, equipment: 'shower', instructions: '3 min hot, 1 min cold. Repeat 3-5 cycles. End with cold.' }
  ];

  const stmt = database.prepare(`
    INSERT INTO exercises (name, category, description, muscle_groups, difficulty, calories_per_minute, equipment, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ex of exercises) {
    stmt.run(ex.name, ex.category, ex.description, ex.muscle_groups, ex.difficulty, ex.calories_per_minute, ex.equipment, ex.instructions);
  }
  console.log('Exercise library seeded with', exercises.length, 'exercises.');
}

module.exports = { getDB, initializeDatabase };
