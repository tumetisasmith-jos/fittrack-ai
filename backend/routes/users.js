const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');

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

// GET /api/users/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare(`
      SELECT id, full_name, username, email, height_cm, weight_kg, age, gender, role, xp_points, level, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('GET /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// PUT /api/users/me
router.put('/me', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    const { full_name, username, height_cm, weight_kg, age, gender } = req.body;

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!current) return res.status(404).json({ error: 'User not found' });

    // Check username uniqueness if changing
    if (username && username !== current.username) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
      if (existing) return res.status(409).json({ error: 'Username already taken' });
    }

    const newFullName = full_name || current.full_name;
    const newUsername = username || current.username;
    const newHeight = height_cm != null ? parseFloat(height_cm) : current.height_cm;
    const newWeight = weight_kg != null ? parseFloat(weight_kg) : current.weight_kg;
    const newAge = age != null ? parseInt(age) : current.age;
    const newGender = gender || current.gender;

    // Award XP for profile update (if height/weight updated)
    let xpDelta = 0;
    if (height_cm != null || weight_kg != null) {
      xpDelta = 10;
    }

    const newXP = current.xp_points + xpDelta;
    const newLevel = calcLevel(newXP);

    db.prepare(`
      UPDATE users
      SET full_name = ?, username = ?, height_cm = ?, weight_kg = ?, age = ?, gender = ?, xp_points = ?, level = ?
      WHERE id = ?
    `).run(newFullName, newUsername, newHeight, newWeight, newAge, newGender, newXP, newLevel, userId);

    // If weight or height was updated, insert new BMI record
    if (height_cm != null || weight_kg != null) {
      const bmi = calcBMI(newWeight, newHeight);
      const category = calcBMICategory(bmi);
      db.prepare(`
        INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, category)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, newWeight, newHeight, bmi, category);
    }

    const updatedUser = db.prepare(`
      SELECT id, full_name, username, email, height_cm, weight_kg, age, gender, role, xp_points, level, created_at
      FROM users WHERE id = ?
    `).get(userId);

    res.json(updatedUser);
  } catch (err) {
    console.error('PUT /me error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
