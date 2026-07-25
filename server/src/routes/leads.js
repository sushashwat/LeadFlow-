const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const VALID_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'NURTURE'];

function logActivity(leadId, userId, action, details) {
  db.prepare(
    `INSERT INTO activity_log (lead_id, user_id, action, details) VALUES (?, ?, ?, ?)`
  ).run(leadId, userId, action, details);
}

// A member may only see/act on leads assigned to them. An admin may see/act
// on everything. This is re-checked on every request - it is never inferred
// from anything the client sends.
function canAccessLead(user, lead) {
  if (user.role === 'admin') return true;
  return lead.assigned_to === user.id;
}

function loadLead(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

router.use(authenticate);

// GET /api/leads?page=1&limit=20&status=new&assigned_to=3&search=acme
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(VALID_STATUSES),
    query('assigned_to').optional().isInt().toInt(),
    query('search').optional().isString().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const offset = (page - 1) * limit;

    const clauses = [];
    const params = {};

    // Server-side permission scoping: members ALWAYS get filtered to their
    // own leads, no matter what assigned_to query param they pass.
    if (req.user.role !== 'admin') {
      clauses.push('assigned_to = @selfId');
      params.selfId = req.user.id;
    } else if (req.query.assigned_to !== undefined) {
      clauses.push('assigned_to = @assignedTo');
      params.assignedTo = req.query.assigned_to;
    }

    if (req.query.status) {
      clauses.push('status = @status');
      params.status = req.query.status;
    }

    if (req.query.search) {
      clauses.push('(name LIKE @search OR email LIKE @search OR company LIKE @search)');
      params.search = `%${req.query.search}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS count FROM leads ${where}`)
      .get(params).count;

    const rows = db
      .prepare(
        `SELECT * FROM leads ${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset });

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }
);

router.get('/:id', (req, res) => {
  const lead = loadLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ error: 'You do not have access to this lead' });
  }
  res.json({ data: lead });
});

router.patch(
  '/:id',
  [
    body('status').optional().isIn(VALID_STATUSES),
    body('name').optional().isString().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional({ nullable: true }).isString().trim(),
    body('company').optional({ nullable: true }).isString().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const lead = loadLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!canAccessLead(req.user, lead)) {
      return res.status(403).json({ error: 'You do not have access to this lead' });
    }
    // Members can only ever move status forward and nothing else - contact
    // info corrections are admin-only, since a rep mistyping a client's
    // email is a data-integrity risk we don't want left open to everyone.
    const fields = req.user.role === 'admin'
      ? ['status', 'name', 'email', 'phone', 'company']
      : ['status'];
    const updates = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const setClause = Object.keys(updates)
      .map((k) => `${k} = @${k}`)
      .join(', ');

    db.prepare(
      `UPDATE leads SET ${setClause}, updated_at = datetime('now') WHERE id = @id`
    ).run({ ...updates, id: lead.id });

    if (updates.status && updates.status !== lead.status) {
      logActivity(
        lead.id,
        req.user.id,
        'status_changed',
        `${lead.status} -> ${updates.status}`
      );
    }
    const otherFields = Object.keys(updates).filter((k) => k !== 'status');
    if (otherFields.length) {
      logActivity(lead.id, req.user.id, 'lead_updated', otherFields.join(', ') + ' updated');
    }

    const updated = loadLead(lead.id);
    res.json({ data: updated });
  }
);

// PATCH /api/leads/:id/assign - admin only. Assigning is an ownership
// decision, not a data edit, so it is intentionally a separate, more
// tightly-guarded endpoint rather than a field on the general PATCH above.
router.patch(
  '/:id/assign',
  authorize('admin'),
  [body('assigned_to').isInt().withMessage('assigned_to (user id) is required')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const lead = loadLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const targetUser = db
      .prepare('SELECT id, name FROM users WHERE id = ?')
      .get(req.body.assigned_to);
    if (!targetUser) return res.status(400).json({ error: 'assigned_to user does not exist' });

    db.prepare(
      `UPDATE leads SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(targetUser.id, lead.id);

    logActivity(lead.id, req.user.id, 'assigned', `Assigned to ${targetUser.name}`);

    res.json({ data: loadLead(lead.id) });
  }
);

router.get('/:id/notes', (req, res) => {
  const lead = loadLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ error: 'You do not have access to this lead' });
  }
  const notes = db
    .prepare(
      `SELECT lead_notes.id, note, lead_notes.created_at, users.name AS author
       FROM lead_notes JOIN users ON users.id = lead_notes.user_id
       WHERE lead_id = ? ORDER BY lead_notes.created_at DESC`
    )
    .all(lead.id);
  res.json({ data: notes });
});

router.post(
  '/:id/notes',
  [body('note').isString().trim().notEmpty().withMessage('Note text is required')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const lead = loadLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!canAccessLead(req.user, lead)) {
      return res.status(403).json({ error: 'You do not have access to this lead' });
    }

    const result = db
      .prepare('INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)')
      .run(lead.id, req.user.id, req.body.note);

    logActivity(lead.id, req.user.id, 'note_added', 'Note added');

    res.status(201).json({ data: { id: result.lastInsertRowid, note: req.body.note } });
  }
);

router.get('/:id/activity', (req, res) => {
  const lead = loadLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!canAccessLead(req.user, lead)) {
    return res.status(403).json({ error: 'You do not have access to this lead' });
  }
  const activity = db
    .prepare(
      `SELECT activity_log.id, action, details, activity_log.created_at,
              users.name AS actor
       FROM activity_log LEFT JOIN users ON users.id = activity_log.user_id
       WHERE lead_id = ? ORDER BY activity_log.created_at DESC`
    )
    .all(lead.id);
  res.json({ data: activity });
});

module.exports = router;
