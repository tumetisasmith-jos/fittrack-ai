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

// GET /api/bmi (last 12 records)
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const records = db.prepare(`
      SELECT * FROM bmi_records
      WHERE user_id = ?
      ORDER BY recorded_at DESC
      LIMIT 12
    `).all(req.user.id);
    res.json(records);
  } catch (err) {
    console.error('GET /bmi error:', err);
    res.status(500).json({ error: 'Failed to fetch BMI records' });
  }
});

// POST /api/bmi
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const { weight_kg, height_cm } = req.body;

    if (!weight_kg || !height_cm) {
      return res.status(400).json({ error: 'weight_kg and height_cm are required' });
    }

    const w = parseFloat(weight_kg);
    const h = parseFloat(height_cm);

    if (w < 20 || w > 500) return res.status(400).json({ error: 'Weight must be between 20 and 500 kg' });
    if (h < 50 || h > 280) return res.status(400).json({ error: 'Height must be between 50 and 280 cm' });

    const bmi = calcBMI(w, h);
    const category = calcBMICategory(bmi);

    const result = db.prepare(`
      INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, category)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, w, h, bmi, category);

    // Also update the user's current weight
    db.prepare('UPDATE users SET weight_kg = ?, height_cm = ? WHERE id = ?').run(w, h, userId);

    const record = db.prepare('SELECT * FROM bmi_records WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(record);
  } catch (err) {
    console.error('POST /bmi error:', err);
    res.status(500).json({ error: 'Failed to record BMI' });
  }
});

module.exports = router;
