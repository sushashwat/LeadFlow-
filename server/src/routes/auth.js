const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isString().notEmpty().withMessage('Password required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Deliberately identical error for "no such user" and "wrong password"
    // so the endpoint doesn't leak which emails are registered.
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }
);

module.exports = router;
