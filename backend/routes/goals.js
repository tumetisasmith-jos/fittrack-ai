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

// GET /api/goals
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const goals = db.prepare(`
      SELECT * FROM goals
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(goals);
  } catch (err) {
    console.error('GET /goals error:', err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/goals
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const { type, target_value, current_value, unit, deadline } = req.body;

    if (!type || !target_value || !unit) {
      return res.status(400).json({ error: 'type, target_value, and unit are required' });
    }

    if (target_value <= 0) {
      return res.status(400).json({ error: 'target_value must be positive' });
    }

    const result = db.prepare(`
      INSERT INTO goals (user_id, type, target_value, current_value, unit, deadline, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(userId, type, parseFloat(target_value), parseFloat(current_value) || 0, unit, deadline || null);

    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid);

    // Award XP +20 for creating a goal
    db.prepare('UPDATE users SET xp_points = xp_points + 20 WHERE id = ?').run(userId);
    const updatedUser = db.prepare('SELECT xp_points FROM users WHERE id = ?').get(userId);
    const newLevel = calcLevel(updatedUser.xp_points);
    db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel, userId);

    res.status(201).json(goal);
  } catch (err) {
    console.error('POST /goals error:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const goalId = parseInt(req.params.id);
    const { current_value, status } = req.body;

    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.user_id !== userId) return res.status(403).json({ error: 'Not authorized to update this goal' });

    const newCurrentValue = current_value != null ? parseFloat(current_value) : goal.current_value;
    let newStatus = status || goal.status;

    // Auto-complete if current_value >= target_value
    if (newCurrentValue >= goal.target_value && newStatus !== 'completed') {
      newStatus = 'completed';
    }

    const wasCompleted = goal.status !== 'completed' && newStatus === 'completed';

    db.prepare(`
      UPDATE goals SET current_value = ?, status = ? WHERE id = ?
    `).run(newCurrentValue, newStatus, goalId);

    // If just completed, award XP and achievement
    if (wasCompleted) {
      db.prepare('UPDATE users SET xp_points = xp_points + 100 WHERE id = ?').run(userId);
      const updatedUser = db.prepare('SELECT xp_points FROM users WHERE id = ?').get(userId);
      const newLevel = calcLevel(updatedUser.xp_points);
      db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel, userId);

      awardAchievement(db, userId, 'goal_crusher');

      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (?, 'goal', '🎯 Goal Completed!', ?)
      `).run(userId, `Congratulations! You completed your goal: ${goal.type.replace(/_/g, ' ')}.`);
    }

    const updatedGoal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
    res.json(updatedGoal);
  } catch (err) {
    console.error('PUT /goals/:id error:', err);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const goalId = parseInt(req.params.id);

    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.user_id !== userId) return res.status(403).json({ error: 'Not authorized to delete this goal' });

    db.prepare('DELETE FROM goals WHERE id = ?').run(goalId);
    res.json({ message: 'Goal deleted successfully' });
  } catch (err) {
    console.error('DELETE /goals/:id error:', err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
