const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  try {
    const db = getDB();

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role != ?').get('admin');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const activeUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM daily_logs
      WHERE date >= ?
    `).get(sevenDaysAgoStr);

    const totalWorkouts = db.prepare('SELECT COUNT(*) as count FROM workouts').get();

    const avgBMI = db.prepare(`
      SELECT AVG(bmi) as avg FROM (
        SELECT user_id, bmi FROM bmi_records
        GROUP BY user_id
        HAVING MAX(recorded_at)
      )
    `).get();

    const avgDailySteps = db.prepare(`
      SELECT AVG(steps) as avg FROM daily_logs WHERE date >= ?
    `).get(sevenDaysAgoStr);

    const mostPopularWorkout = db.prepare(`
      SELECT type, COUNT(*) as count FROM workouts
      GROUP BY type ORDER BY count DESC LIMIT 1
    `).get();

    const totalGoals = db.prepare('SELECT COUNT(*) as count FROM goals').get();
    const completedGoals = db.prepare('SELECT COUNT(*) as count FROM goals WHERE status = ?').get('completed');
    const goalCompletionRate = totalGoals.count > 0
      ? parseFloat(((completedGoals.count / totalGoals.count) * 100).toFixed(1))
      : 0;

    res.json({
      total_users: totalUsers.count,
      active_users: activeUsers.count,
      total_workouts: totalWorkouts.count,
      avg_bmi: avgBMI.avg ? parseFloat(avgBMI.avg.toFixed(1)) : null,
      avg_daily_steps: avgDailySteps.avg ? Math.round(avgDailySteps.avg) : 0,
      most_popular_workout: mostPopularWorkout ? mostPopularWorkout.type : null,
      goal_completion_rate: goalCompletionRate,
      total_goals: totalGoals.count,
      completed_goals: completedGoals.count
    });
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/users (paginated)
router.get('/users', (req, res) => {
  try {
    const db = getDB();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE (full_name LIKE ? OR email LIKE ? OR username LIKE ?)
    `).get(search, search, search);

    const users = db.prepare(`
      SELECT
        u.id, u.full_name, u.username, u.email, u.age, u.gender,
        u.height_cm, u.weight_kg, u.role, u.xp_points, u.level, u.created_at,
        (SELECT COUNT(*) FROM workouts w WHERE w.user_id = u.id) as workout_count,
        (SELECT MAX(date) FROM daily_logs dl WHERE dl.user_id = u.id) as last_active
      FROM users u
      WHERE (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(search, search, search, limit, offset);

    res.json({
      users,
      total: totalCount.count,
      page,
      limit,
      total_pages: Math.ceil(totalCount.count / limit)
    });
  } catch (err) {
    console.error('GET /admin/users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', (req, res) => {
  try {
    const db = getDB();

    // User growth: last 30 days (sign-up count per day)
    const userGrowthRows = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all();

    // Fill in missing days with 0
    const userGrowth = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = userGrowthRows.find(r => r.date === dateStr);
      userGrowth.push({ date: dateStr, count: found ? found.count : 0 });
    }

    // Workout distribution by type
    const workoutDistribution = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM workouts
      GROUP BY type
      ORDER BY count DESC
    `).all();

    // Daily activity: last 7 days average steps
    const dailyActivityRows = db.prepare(`
      SELECT
        date,
        ROUND(AVG(steps)) as avg_steps
      FROM daily_logs
      WHERE date >= DATE('now', '-7 days')
      GROUP BY date
      ORDER BY date ASC
    `).all();

    // Fill in missing days for last 7 days
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = dailyActivityRows.find(r => r.date === dateStr);
      dailyActivity.push({ date: dateStr, avg_steps: found ? Math.round(found.avg_steps) : 0 });
    }

    res.json({
      user_growth: userGrowth,
      workout_distribution: workoutDistribution,
      daily_activity: dailyActivity
    });
  } catch (err) {
    console.error('GET /admin/analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/nutrition-stats
router.get('/nutrition-stats', (req, res) => {
  try {
    const db = getDB();
    const avgDaily = db.prepare("SELECT ROUND(AVG(daily_total)) as avg_daily_calories FROM (SELECT date, SUM(calories) as daily_total FROM meals GROUP BY user_id, date)").get();
    const macroAvg = db.prepare("SELECT ROUND(AVG(protein_g),1) as avg_protein, ROUND(AVG(carbs_g),1) as avg_carbs, ROUND(AVG(fat_g),1) as avg_fat FROM meals").get();
    const topFoods = db.prepare("SELECT food_name, COUNT(*) as count FROM meals GROUP BY food_name ORDER BY count DESC LIMIT 8").all();
    const mealDist = db.prepare("SELECT meal_type, COUNT(*) as count FROM meals GROUP BY meal_type ORDER BY count DESC").all();
    const totalMeals = db.prepare("SELECT COUNT(*) as count FROM meals").get();
    res.json({ avg_daily_calories: avgDaily.avg_daily_calories||0, avg_protein: macroAvg.avg_protein||0, avg_carbs: macroAvg.avg_carbs||0, avg_fat: macroAvg.avg_fat||0, top_foods: topFoods, meal_distribution: mealDist, total_meals: totalMeals.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/health-trends
router.get('/health-trends', (req, res) => {
  try {
    const db = getDB();
    const stepsTrend = db.prepare("SELECT date, ROUND(AVG(steps)) as avg_steps, ROUND(AVG(sleep_hours),1) as avg_sleep, ROUND(AVG(water_ml)) as avg_water, ROUND(AVG(mood),1) as avg_mood, ROUND(AVG(energy_level),1) as avg_energy FROM daily_logs WHERE date >= DATE('now','-14 days') GROUP BY date ORDER BY date").all();
    const hrTrend    = db.prepare("SELECT DATE(recorded_at) as date, ROUND(AVG(bpm)) as avg_bpm FROM heart_rate_logs WHERE recorded_at >= DATETIME('now','-14 days') GROUP BY DATE(recorded_at) ORDER BY date").all();
    const bmiDist    = db.prepare("SELECT category, COUNT(DISTINCT user_id) as count FROM (SELECT user_id, category FROM bmi_records GROUP BY user_id HAVING MAX(recorded_at)) GROUP BY category").all();
    const goalStatus = db.prepare("SELECT status, COUNT(*) as count FROM goals GROUP BY status").all();
    res.json({ steps_trend: stepsTrend, heart_rate_trend: hrTrend, bmi_distribution: bmiDist, goal_status: goalStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

