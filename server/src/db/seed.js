const bcrypt = require('bcryptjs');
const db = require('./index');

function upsertUser(name, email, password, role) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  const hash = bcrypt.hashSync(password, 10);
  if (existing) {
    db.prepare('UPDATE users SET name = ?, password_hash = ?, role = ? WHERE id = ?').run(
      name,
      hash,
      role,
      existing.id
    );
    console.log(`Updated ${role}: ${email}`);
  } else {
    db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, hash, role);
    console.log(`Created ${role}: ${email}`);
  }
}

upsertUser('Ava Admin', 'admin@leadflow.dev', 'AdminPass123!', 'admin');
upsertUser('Max Member', 'member@leadflow.dev', 'MemberPass123!', 'member');

console.log('Seeding complete.');
