const express = require('express');
const router  = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');
router.use(authenticateToken);

// GET /api/exercises — full library, filterable
router.get('/', (req, res) => {
  try {
    const db         = getDB();
    const { category, difficulty, q } = req.query;
    let sql    = 'SELECT * FROM exercises WHERE 1=1';
    const params = [];
    if (category && category !== 'all') { sql += ' AND category=?'; params.push(category); }
    if (difficulty && difficulty !== 'all') { sql += ' AND difficulty=?'; params.push(difficulty); }
    if (q) { sql += ' AND (name LIKE ? OR muscle_groups LIKE ? OR description LIKE ?)'; const like = `%${q}%`; params.push(like, like, like); }
    sql += ' ORDER BY category, name';
    const exercises = db.prepare(sql).all(...params);
    res.json(exercises);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/exercises/categories — distinct categories
router.get('/categories', (req, res) => {
  try {
    const db  = getDB();
    const cats = db.prepare('SELECT DISTINCT category FROM exercises ORDER BY category').all();
    res.json(cats.map(c => c.category));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/exercises/:id
router.get('/:id', (req, res) => {
  try {
    const db  = getDB();
    const ex  = db.prepare('SELECT * FROM exercises WHERE id=?').get(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    res.json(ex);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
