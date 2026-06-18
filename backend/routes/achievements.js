const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const BADGES = {
  first_workout: { name: '🏃 First Workout', icon: '🏃', xp: 50 },
  streak_7: { name: '🔥 7-Day Streak', icon: '🔥', xp: 100 },
  streak_30: { name: '💫 30-Day Streak', icon: '💫', xp: 300 },
  hydration_master: { name: '💧 Hydration Master', icon: '💧', xp: 75 },
  goal_crusher: { name: '🎯 Goal Crusher', icon: '🎯', xp: 100 },
  step_master: { name: '👟 Step Master', icon: '👟', xp: 75 },
  iron_will: { name: '💪 Iron Will', icon: '💪', xp: 150 }
};

/**
 * Award an achievement to a user.
 * This function is exported so other routes can call it.
 * @param {Database} db - The SQLite database instance
 * @param {number} userId - The user ID
 * @param {string} badgeKey - The badge key from BADGES
 * @returns {boolean} - true if newly awarded, false if already had it
 */
function awardAchievement(db, userId, badgeKey) {
  const badge = BADGES[badgeKey];
  if (!badge) return false;

  const existing = db.prepare('SELECT id FROM achievements WHERE user_id = ? AND badge_key = ?').get(userId, badgeKey);
  if (existing) return false;

  db.prepare(`
    INSERT OR IGNORE INTO achievements (user_id, badge_key, badge_name, badge_icon, xp_awarded)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, badgeKey, badge.name, badge.icon, badge.xp);

  // Award XP for the achievement
  db.prepare('UPDATE users SET xp_points = xp_points + ? WHERE id = ?').run(badge.xp, userId);
  const updatedUser = db.prepare('SELECT xp_points FROM users WHERE id = ?').get(userId);
  const newLevel = calcLevel(updatedUser.xp_points);
  db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel, userId);

  // Create notification for the achievement
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (?, 'achievement', '🏆 Achievement Unlocked!', ?)
  `).run(userId, `You earned the "${badge.name}" badge and ${badge.xp} XP!`);

  return true;
}

function calcLevel(xp) {
  if (xp >= 2000) return 'Elite';
  if (xp >= 1000) return 'Platinum';
  if (xp >= 600) return 'Gold';
  if (xp >= 300) return 'Silver';
  if (xp >= 100) return 'Bronze';
  return 'Beginner';
}

// GET /api/achievements
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const achievements = db.prepare(`
      SELECT * FROM achievements
      WHERE user_id = ?
      ORDER BY earned_at DESC
    `).all(req.user.id);

    const totalXP = achievements.reduce((sum, a) => sum + a.xp_awarded, 0);

    res.json({ achievements, total_xp: totalXP });
  } catch (err) {
    console.error('GET /achievements error:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

module.exports = router;
module.exports.awardAchievement = awardAchievement;
module.exports.BADGES = BADGES;
