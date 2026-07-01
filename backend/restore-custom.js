const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'fittrack.db');
const db = new DatabaseSync(DB_PATH);

const users = [
  { 
    full_name: 'Tumeti Sasmith Joseph', 
    username: 'tumeti', 
    email: 'tumeti@fittrack.ai', 
    password: 'password123', 
    age: 25, gender: 'male', height_cm: 175, weight_kg: 70 
  },
  { 
    full_name: 'Shresta Joanna', 
    username: 'shresta', 
    email: 'shresta@fittrack.ai', 
    password: 'password123', 
    age: 25, gender: 'female', height_cm: 165, weight_kg: 60 
  }
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (full_name, username, email, password_hash, height_cm, weight_kg, age, gender, role, xp_points, level)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 0, 'Beginner')
`);

const insertBMI = db.prepare(`INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, category) VALUES (?, ?, ?, ?, ?)`);

function calcBMI(w, h) { return parseFloat((w / Math.pow(h / 100, 2)).toFixed(1)); }
function bmiCat(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

db.exec('BEGIN TRANSACTION');
try {
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    const res = insertUser.run(u.full_name, u.username, u.email, hash, u.height_cm, u.weight_kg, u.age, u.gender);
    if (res.changes > 0) {
      const uid = res.lastInsertRowid;
      const bmi = calcBMI(u.weight_kg, u.height_cm);
      insertBMI.run(uid, u.weight_kg, u.height_cm, bmi, bmiCat(bmi));
    }
  }
  db.exec('COMMIT');
  console.log('Restored the 2 specific users.');
} catch (err) {
  db.exec('ROLLBACK');
  console.error(err);
}
