const express = require('express');
const router  = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');
router.use(authenticateToken);

// GET /api/heart-rate — last 30 days
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare("SELECT * FROM heart_rate_logs WHERE user_id=? AND recorded_at >= DATETIME('now','-30 days') ORDER BY recorded_at DESC").all(req.user.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/heart-rate/stats
router.get('/stats', (req, res) => {
  try {
    const db  = getDB();
    const uid = req.user.id;
    const avg = db.prepare("SELECT ROUND(AVG(bpm)) as avg, MIN(bpm) as min, MAX(bpm) as max FROM heart_rate_logs WHERE user_id=? AND recorded_at >= DATETIME('now','-30 days')").get(uid);
    const resting = db.prepare("SELECT ROUND(AVG(bpm)) as avg FROM heart_rate_logs WHERE user_id=? AND context='resting' AND recorded_at >= DATETIME('now','-7 days')").get(uid);
    const latest  = db.prepare("SELECT bpm, context, recorded_at FROM heart_rate_logs WHERE user_id=? ORDER BY recorded_at DESC LIMIT 1").get(uid);
    const trend   = db.prepare("SELECT DATE(recorded_at) as date, ROUND(AVG(bpm)) as avg_bpm FROM heart_rate_logs WHERE user_id=? AND recorded_at >= DATETIME('now','-14 days') GROUP BY DATE(recorded_at) ORDER BY date").all(uid);
    res.json({ avg: avg.avg||0, min: avg.min||0, max: avg.max||0, resting_avg: resting.avg||0, latest, trend });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/heart-rate
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { bpm, context, notes } = req.body;
    if (!bpm || bpm < 30 || bpm > 250) return res.status(400).json({ error: 'bpm must be between 30 and 250' });
    const validCtx = ['resting','active','post-workout','sleeping'];
    const ctx = validCtx.includes(context) ? context : 'resting';
    const result = db.prepare('INSERT INTO heart_rate_logs (user_id,bpm,context,notes) VALUES (?,?,?,?)').run(req.user.id, bpm, ctx, notes||null);
    res.status(201).json(db.prepare('SELECT * FROM heart_rate_logs WHERE id=?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/heart-rate/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    const row = db.prepare('SELECT id FROM heart_rate_logs WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Record not found' });
    db.prepare('DELETE FROM heart_rate_logs WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
