const express = require('express');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// GET /api/users - admin only. Used to populate "assign to" pickers.
router.get('/', authenticate, authorize('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all();
  res.json({ data: users });
});

module.exports = router;
