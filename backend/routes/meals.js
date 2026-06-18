const express = require('express');
const router  = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');
router.use(authenticateToken);

// GET /api/meals — last 30 days
router.get('/', (req, res) => {
  try {
    const db   = getDB();
    const date = req.query.date; // optional filter
    let meals;
    if (date) {
      meals = db.prepare('SELECT * FROM meals WHERE user_id=? AND date=? ORDER BY meal_type,created_at').all(req.user.id, date);
    } else {
      meals = db.prepare("SELECT * FROM meals WHERE user_id=? AND date >= DATE('now','-30 days') ORDER BY date DESC,meal_type").all(req.user.id);
    }
    res.json(meals);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/meals/today — today's meals with totals
router.get('/today', (req, res) => {
  try {
    const db      = getDB();
    const today   = new Date().toISOString().split('T')[0];
    const meals   = db.prepare("SELECT * FROM meals WHERE user_id=? AND date=? ORDER BY meal_type").all(req.user.id, today);
    const totals  = db.prepare("SELECT SUM(calories) as cal, SUM(protein_g) as protein, SUM(carbs_g) as carbs, SUM(fat_g) as fat FROM meals WHERE user_id=? AND date=?").get(req.user.id, today);
    res.json({ meals, totals: { calories: totals.cal||0, protein: totals.protein||0, carbs: totals.carbs||0, fat: totals.fat||0 } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/meals/summary — 7-day calorie summary
router.get('/summary', (req, res) => {
  try {
    const db   = getDB();
    const rows = db.prepare("SELECT date, SUM(calories) as total_cal, SUM(protein_g) as protein, SUM(carbs_g) as carbs, SUM(fat_g) as fat FROM meals WHERE user_id=? AND date >= DATE('now','-7 days') GROUP BY date ORDER BY date").all(req.user.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/meals
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { meal_type, food_name, quantity_g, calories, protein_g, carbs_g, fat_g, notes, date } = req.body;
    if (!meal_type || !food_name) return res.status(400).json({ error: 'meal_type and food_name required' });
    const validTypes = ['breakfast','lunch','dinner','snack'];
    if (!validTypes.includes(meal_type)) return res.status(400).json({ error: 'Invalid meal_type' });
    const mealDate = date || new Date().toISOString().split('T')[0];
    const result = db.prepare(`INSERT INTO meals (user_id,date,meal_type,food_name,quantity_g,calories,protein_g,carbs_g,fat_g,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(req.user.id, mealDate, meal_type, food_name, quantity_g||100, calories||0, protein_g||0, carbs_g||0, fat_g||0, notes||null);
    const meal = db.prepare('SELECT * FROM meals WHERE id=?').get(result.lastInsertRowid);
    res.status(201).json(meal);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/meals/:id
router.delete('/:id', (req, res) => {
  try {
    const db   = getDB();
    const meal = db.prepare('SELECT id FROM meals WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    db.prepare('DELETE FROM meals WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
