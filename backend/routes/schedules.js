const express = require('express');
const router  = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');
router.use(authenticateToken);

// GET /api/schedules
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { status, from, to } = req.query;
    let sql = 'SELECT * FROM workout_schedules WHERE user_id=?';
    const params = [req.user.id];
    if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
    if (from) { sql += ' AND scheduled_date>=?'; params.push(from); }
    if (to)   { sql += ' AND scheduled_date<=?'; params.push(to); }
    sql += ' ORDER BY scheduled_date ASC, scheduled_time ASC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/schedules/upcoming — next 7 days pending
router.get('/upcoming', (req, res) => {
  try {
    const db   = getDB();
    const rows = db.prepare("SELECT * FROM workout_schedules WHERE user_id=? AND scheduled_date >= DATE('now') AND scheduled_date <= DATE('now','+7 days') AND status='pending' ORDER BY scheduled_date,scheduled_time").all(req.user.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/schedules
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { title, workout_type, scheduled_date, scheduled_time, duration_minutes, notes } = req.body;
    if (!title || !workout_type || !scheduled_date) return res.status(400).json({ error: 'title, workout_type and scheduled_date required' });
    const result = db.prepare(`INSERT INTO workout_schedules (user_id,title,workout_type,scheduled_date,scheduled_time,duration_minutes,notes) VALUES (?,?,?,?,?,?,?)`)
      .run(req.user.id, title, workout_type, scheduled_date, scheduled_time||'07:00', duration_minutes||30, notes||null);
    res.status(201).json(db.prepare('SELECT * FROM workout_schedules WHERE id=?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/schedules/:id — update status
router.put('/:id', (req, res) => {
  try {
    const db = getDB();
    const sched = db.prepare('SELECT id FROM workout_schedules WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });
    const { status, notes, scheduled_date, scheduled_time, duration_minutes, title, workout_type } = req.body;
    db.prepare(`UPDATE workout_schedules SET status=COALESCE(?,status), notes=COALESCE(?,notes), scheduled_date=COALESCE(?,scheduled_date), scheduled_time=COALESCE(?,scheduled_time), duration_minutes=COALESCE(?,duration_minutes), title=COALESCE(?,title), workout_type=COALESCE(?,workout_type) WHERE id=?`)
      .run(status, notes, scheduled_date, scheduled_time, duration_minutes, title, workout_type, req.params.id);
    res.json(db.prepare('SELECT * FROM workout_schedules WHERE id=?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/schedules/:id
router.delete('/:id', (req, res) => {
  try {
    const db    = getDB();
    const sched = db.prepare('SELECT id FROM workout_schedules WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });
    db.prepare('DELETE FROM workout_schedules WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
