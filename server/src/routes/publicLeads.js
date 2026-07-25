const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');

const router = express.Router();

// POST /api/public/leads - the public-facing capture form submits here.
// Deliberately unauthenticated: this is the only endpoint the outside
// world can write to, and it can only ever CREATE a lead in 'new' status -
// it cannot set status, assignment, or any internal field.
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').optional().isString().trim(),
    body('company').optional().isString().trim(),
    body('message').optional().isString().trim().isLength({ max: 2000 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { name, email, phone = null, company = null, message = null } = req.body;

    const result = db
      .prepare(
        `INSERT INTO leads (name, email, phone, company, message, source, status)
         VALUES (?, ?, ?, ?, ?, 'website', 'NEW')`
      )
      .run(name, email, phone, company, message);

    db.prepare(
      `INSERT INTO activity_log (lead_id, user_id, action, details)
       VALUES (?, NULL, 'created', 'Lead submitted via public capture form')`
    ).run(result.lastInsertRowid);

    return res.status(201).json({
      message: "Thanks - we'll be in touch shortly.",
      leadId: result.lastInsertRowid,
    });
  }
);

module.exports = router;
