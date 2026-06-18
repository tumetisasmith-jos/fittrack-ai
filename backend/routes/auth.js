const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'fittrack_ai_super_secret_jwt_key_2024';

function calcBMI(weight_kg, height_cm) {
  return parseFloat((weight_kg / Math.pow(height_cm / 100, 2)).toFixed(1));
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

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  try {
    const db = getDB();
    const { full_name, username, email, password, height_cm, weight_kg, age, gender } = req.body;

    if (!full_name || !username || !email || !password) {
      return res.status(400).json({ error: 'full_name, username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check duplicates
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) return res.status(409).json({ error: 'Email already in use' });

    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUsername) return res.status(409).json({ error: 'Username already taken' });

    const password_hash = bcrypt.hashSync(password, 10);
    const h = parseFloat(height_cm) || 170;
    const w = parseFloat(weight_kg) || 70;
    const a = parseInt(age) || 25;
    const g = gender || 'other';

    const result = db.prepare(`
      INSERT INTO users (full_name, username, email, password_hash, height_cm, weight_kg, age, gender, role, xp_points, level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 0, 'Beginner')
    `).run(full_name, username, email.toLowerCase(), password_hash, h, w, a, g);

    const userId = result.lastInsertRowid;

    // Insert initial BMI record if height and weight provided
    if (height_cm && weight_kg) {
      const bmi = calcBMI(w, h);
      const category = calcBMICategory(bmi);
      db.prepare(`
        INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, category)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, w, h, bmi, category);
    }

    const user = db.prepare('SELECT id, email, username, full_name, role, xp_points, level, height_cm, weight_kg, age, gender FROM users WHERE id = ?').get(userId);

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, full_name: user.full_name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const db = getDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, full_name: user.full_name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  try {
    const db = getDB();
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = db.prepare('SELECT id, email, full_name FROM users WHERE email=?').get(email.toLowerCase());
    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    // Clean old tokens
    db.prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id);

    // Generate token (crypto random hex)
    const crypto = require('crypto');
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    db.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?,?,?)').run(user.id, token, expiry);

    // In production send email; for demo, log to console
    console.log(`\n🔑 Password Reset Token for ${email}: ${token}`);
    console.log(`   Reset URL: http://localhost:3000/forgot-password.html?token=${token}\n`);

    res.json({ message: 'If that email exists, a reset link has been sent.', demo_token: token });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  try {
    const db = getDB();
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new_password required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const reset = db.prepare("SELECT * FROM password_resets WHERE token=? AND used=0 AND expires_at > DATETIME('now')").get(token);
    if (!reset) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, reset.user_id);
    db.prepare('UPDATE password_resets SET used=1 WHERE id=?').run(reset.id);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

