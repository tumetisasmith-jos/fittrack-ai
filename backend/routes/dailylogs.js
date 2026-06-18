const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { awardAchievement } = require('./achievements');

function calcLevel(xp) {
  if (xp >= 2000) return 'Elite';
  if (xp >= 1000) return 'Platinum';
  if (xp >= 600) return 'Gold';
  if (xp >= 300) return 'Silver';
  if (xp >= 100) return 'Bronze';
  return 'Beginner';
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// GET /api/daily-logs (last 30 days)
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

    const logs = db.prepare(`
      SELECT * FROM daily_logs
      WHERE user_id = ? AND date >= ?
      ORDER BY date DESC
    `).all(req.user.id, fromDate);

    res.json(logs);
  } catch (err) {
    console.error('GET /daily-logs error:', err);
    res.status(500).json({ error: 'Failed to fetch daily logs' });
  }
});

// GET /api/daily-logs/today
router.get('/today', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const today = getTodayStr();
    const log = db.prepare(`
      SELECT * FROM daily_logs WHERE user_id = ? AND date = ?
    `).get(req.user.id, today);

    if (!log) {
      return res.json({
        user_id: req.user.id,
        date: today,
        steps: 0,
        water_ml: 0,
        sleep_hours: 0,
        calories_burned: 0,
        mood: 3,
        energy_level: 3,
        weight_kg: null
      });
    }

    res.json(log);
  } catch (err) {
    console.error('GET /daily-logs/today error:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s log' });
  }
});

// GET /api/daily-logs/week (last 7 days)
router.get('/week', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fromDate = sevenDaysAgo.toISOString().split('T')[0];

    const logs = db.prepare(`
      SELECT * FROM daily_logs
      WHERE user_id = ? AND date >= ?
      ORDER BY date DESC
    `).all(req.user.id, fromDate);

    res.json(logs);
  } catch (err) {
    console.error('GET /daily-logs/week error:', err);
    res.status(500).json({ error: 'Failed to fetch weekly logs' });
  }
});

// POST /api/daily-logs (upsert today's log)
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const { steps, water_ml, sleep_hours, calories_burned, mood, energy_level, weight_kg, date } = req.body;

    const logDate = date || getTodayStr();

    // Validate ranges
    if (steps != null && (steps < 0 || steps > 100000)) {
      return res.status(400).json({ error: 'Steps must be between 0 and 100,000' });
    }
    if (water_ml != null && (water_ml < 0 || water_ml > 10000)) {
      return res.status(400).json({ error: 'Water intake must be between 0 and 10,000 ml' });
    }
    if (sleep_hours != null && (sleep_hours < 0 || sleep_hours > 24)) {
      return res.status(400).json({ error: 'Sleep hours must be between 0 and 24' });
    }
    if (mood != null && (mood < 1 || mood > 5)) {
      return res.status(400).json({ error: 'Mood must be between 1 and 5' });
    }
    if (energy_level != null && (energy_level < 1 || energy_level > 5)) {
      return res.status(400).json({ error: 'Energy level must be between 1 and 5' });
    }

    // Get existing log if any
    const existing = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date = ?').get(userId, logDate);

    const s = steps != null ? parseInt(steps) : (existing ? existing.steps : 0);
    const w = water_ml != null ? parseFloat(water_ml) : (existing ? existing.water_ml : 0);
    const sl = sleep_hours != null ? parseFloat(sleep_hours) : (existing ? existing.sleep_hours : 0);
    const c = calories_burned != null ? parseInt(calories_burned) : (existing ? existing.calories_burned : 0);
    const m = mood != null ? parseInt(mood) : (existing ? existing.mood : 3);
    const e = energy_level != null ? parseInt(energy_level) : (existing ? existing.energy_level : 3);
    const wt = weight_kg != null ? parseFloat(weight_kg) : (existing ? existing.weight_kg : null);

    db.prepare(`
      INSERT INTO daily_logs (user_id, date, steps, water_ml, sleep_hours, calories_burned, mood, energy_level, weight_kg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        steps = excluded.steps,
        water_ml = excluded.water_ml,
        sleep_hours = excluded.sleep_hours,
        calories_burned = excluded.calories_burned,
        mood = excluded.mood,
        energy_level = excluded.energy_level,
        weight_kg = excluded.weight_kg
    `).run(userId, logDate, s, w, sl, c, m, e, wt);

    // Award XP +10 for logging today
    if (logDate === getTodayStr()) {
      db.prepare('UPDATE users SET xp_points = xp_points + 10 WHERE id = ?').run(userId);
      const updatedUser = db.prepare('SELECT xp_points FROM users WHERE id = ?').get(userId);
      const newLevel = calcLevel(updatedUser.xp_points);
      db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel, userId);
    }

    // Achievement: step_master if steps >= 10000
    if (s >= 10000) {
      awardAchievement(db, userId, 'step_master');
    }

    // Achievement: hydration_master - check if user had >= 2000ml water on 7+ days
    const hydrationDays = db.prepare(`
      SELECT COUNT(*) as count FROM daily_logs
      WHERE user_id = ? AND water_ml >= 2000
    `).get(userId);
    if (hydrationDays.count >= 7) {
      awardAchievement(db, userId, 'hydration_master');
    }

    const log = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date = ?').get(userId, logDate);
    res.status(201).json(log);
  } catch (err) {
    console.error('POST /daily-logs error:', err);
    res.status(500).json({ error: 'Failed to save daily log' });
  }
});

module.exports = router;
