const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications (unread first, last 20)
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY is_read ASC, created_at DESC
      LIMIT 20
    `).all(req.user.id);
    res.json(notifications);
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(req.user.id);
    res.json({ count: result.count });
  } catch (err) {
    console.error('GET /notifications/unread-count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const notifId = parseInt(req.params.id);

    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notifId);
    const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
    res.json(updated);
  } catch (err) {
    console.error('PUT /notifications/:id/read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('POST /notifications/mark-all-read error:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

module.exports = router;
