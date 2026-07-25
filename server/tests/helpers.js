const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { signToken } = require('../src/auth');

function createUser({ name, email, password, role }) {
  const hash = bcrypt.hashSync(password, 4); // low cost factor - tests only
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, role);
  return { id: result.lastInsertRowid, name, email, role };
}

function tokenFor(user) {
  return signToken(user);
}

function resetDb() {
  db.exec(`
    DELETE FROM activity_log;
    DELETE FROM lead_notes;
    DELETE FROM leads;
    DELETE FROM users;
  `);
}

module.exports = { createUser, tokenFor, resetDb };
