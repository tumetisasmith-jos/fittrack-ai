const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { awardAchievement } = require('./achievements');

// GET /api/workouts
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const workouts = db.prepare(`
      SELECT * FROM workouts
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT 100
    `).all(req.user.id);
    res.json(workouts);
  } catch (err) {
    console.error('GET /workouts error:', err);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// GET /api/workouts/stats
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_workouts,
        COALESCE(SUM(calories_burned), 0) as total_calories,
        COALESCE(SUM(duration_minutes), 0) as total_duration
      FROM workouts WHERE user_id = ?
    `).get(userId);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const weekCount = db.prepare(`
      SELECT COUNT(*) as count FROM workouts
      WHERE user_id = ? AND date >= ?
    `).get(userId, weekStartStr);

    const favoriteType = db.prepare(`
      SELECT type, COUNT(*) as count FROM workouts
      WHERE user_id = ?
      GROUP BY type ORDER BY count DESC LIMIT 1
    `).get(userId);

    res.json({
      total_workouts: totals.total_workouts,
      total_calories: totals.total_calories,
      total_duration: totals.total_duration,
      this_week_count: weekCount.count,
      favorite_type: favoriteType ? favoriteType.type : null
    });
  } catch (err) {
    console.error('GET /workouts/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch workout stats' });
  }
});

// POST /api/workouts
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const { type, duration_minutes, calories_burned, notes, date } = req.body;

    if (!type || !duration_minutes || !calories_burned || !date) {
      return res.status(400).json({ error: 'type, duration_minutes, calories_burned, and date are required' });
    }

    if (duration_minutes < 1 || duration_minutes > 600) {
      return res.status(400).json({ error: 'Duration must be between 1 and 600 minutes' });
    }

    if (calories_burned < 0 || calories_burned > 5000) {
      return res.status(400).json({ error: 'Calories burned must be between 0 and 5000' });
    }

    const result = db.prepare(`
      INSERT INTO workouts (user_id, type, duration_minutes, calories_burned, notes, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, type, parseInt(duration_minutes), parseInt(calories_burned), notes || null, date);

    const workout = db.prepare('SELECT * FROM workouts WHERE id = ?').get(result.lastInsertRowid);

    // Award XP +30
    db.prepare('UPDATE users SET xp_points = xp_points + 30 WHERE id = ?').run(userId);
    const updatedUser = db.prepare('SELECT xp_points FROM users WHERE id = ?').get(userId);
    const newLevel = calcLevel(updatedUser.xp_points);
    db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel, userId);

    // Achievement checks
    const workoutCount = db.prepare('SELECT COUNT(*) as count FROM workouts WHERE user_id = ?').get(userId);

    if (workoutCount.count === 1) {
      awardAchievement(db, userId, 'first_workout');
    }
    if (workoutCount.count >= 10) {
      awardAchievement(db, userId, 'iron_will');
    }

    res.status(201).json(workout);
  } catch (err) {
    console.error('POST /workouts error:', err);
    res.status(500).json({ error: 'Failed to create workout' });
  }
});

// DELETE /api/workouts/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const workoutId = parseInt(req.params.id);

    const workout = db.prepare('SELECT * FROM workouts WHERE id = ?').get(workoutId);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    if (workout.user_id !== userId) return res.status(403).json({ error: 'Not authorized to delete this workout' });

    db.prepare('DELETE FROM workouts WHERE id = ?').run(workoutId);
    res.json({ message: 'Workout deleted successfully' });
  } catch (err) {
    console.error('DELETE /workouts/:id error:', err);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
});

function calcLevel(xp) {
  if (xp >= 2000) return 'Elite';
  if (xp >= 1000) return 'Platinum';
  if (xp >= 600) return 'Gold';
  if (xp >= 300) return 'Silver';
  if (xp >= 100) return 'Bronze';
  return 'Beginner';
}

module.exports = router;
