const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'fittrack.db');
const db = new DatabaseSync(DB_PATH);

const updates = [
  { username: 'tumeti', email: 'tumetisasmith@gmail.com', password: 'joseph@123' },
  { username: 'shresta', email: 'shrestatumeti@gmail.com', password: 'shresta@123' }
];

const stmt = db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE username = ?');

db.exec('BEGIN TRANSACTION');
try {
  for (const u of updates) {
    const hash = bcrypt.hashSync(u.password, 10);
    stmt.run(u.email, hash, u.username);
  }
  db.exec('COMMIT');
  console.log('User credentials updated successfully.');
} catch (err) {
  db.exec('ROLLBACK');
  console.error(err);
}
