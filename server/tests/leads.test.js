const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { createUser, tokenFor, resetDb } = require('./helpers');

beforeEach(() => resetDb());

describe('Core flow: public capture -> assign -> status change -> notes -> activity trail', () => {
  test('a lead moves through its whole lifecycle correctly', async () => {
    const admin = createUser({
      name: 'Ava Admin',
      email: 'ava@flow.dev',
      password: 'x',
      role: 'admin',
    });
    const member = createUser({
      name: 'Max Member',
      email: 'max@flow.dev',
      password: 'x',
      role: 'member',
    });
    const adminToken = tokenFor(admin);
    const memberToken = tokenFor(member);

    // 1. Public capture form submits with no auth
    const capture = await request(app).post('/api/public/leads').send({
      name: 'Jordan Prospect',
      email: 'jordan@prospect.com',
      company: 'Prospect Co',
      message: 'Interested in a Shopify rebuild',
    });
    expect(capture.status).toBe(201);
    const leadId = capture.body.leadId;

    // New lead starts unassigned, status 'NEW'
    let lead = await request(app)
      .get(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(lead.body.data.status).toBe('NEW');
    expect(lead.body.data.assigned_to).toBeNull();

    // Member cannot see it yet - not assigned to them
    const blocked = await request(app)
      .get(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(blocked.status).toBe(403);

    // 2. Admin assigns it to the member
    const assign = await request(app)
      .patch(`/api/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigned_to: member.id });
    expect(assign.status).toBe(200);
    expect(assign.body.data.assigned_to).toBe(member.id);

    // Now the member can see it
    const nowVisible = await request(app)
      .get(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(nowVisible.status).toBe(200);

    // 3. Member moves it through the pipeline
    const statusChange = await request(app)
      .patch(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'CONTACTED' });
    expect(statusChange.status).toBe(200);
    expect(statusChange.body.data.status).toBe('CONTACTED');

    // 4. Member adds a note
    const note = await request(app)
      .post(`/api/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ note: 'Left a voicemail, will follow up Thursday.' });
    expect(note.status).toBe(201);

    const notes = await request(app)
      .get(`/api/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(notes.body.data.length).toBe(1);
    expect(notes.body.data[0].author).toBe('Max Member');

    // 5. Activity trail reflects every step: created, assigned, status_changed, note_added
    const activity = await request(app)
      .get(`/api/leads/${leadId}/activity`)
      .set('Authorization', `Bearer ${memberToken}`);
    const actions = activity.body.data.map((a) => a.action).sort();
    expect(actions).toEqual(['assigned', 'created', 'note_added', 'status_changed']);
  });
});

describe('Core flow: pagination and filtering', () => {
  test('list endpoint paginates and filters by status correctly', async () => {
    const admin = createUser({
      name: 'Ava Admin',
      email: 'ava@page.dev',
      password: 'x',
      role: 'admin',
    });
    const adminToken = tokenFor(admin);

    const statuses = ['NEW', 'NEW', 'CONTACTED', 'WON', 'LOST', 'NEW'];
    statuses.forEach((status, i) => {
      db.prepare(
        `INSERT INTO leads (name, email, source, status) VALUES (?, ?, 'website', ?)`
      ).run(`Lead ${i}`, `lead${i}@x.com`, status);
    });

    // Filter by status=new should return exactly 3
    const filtered = await request(app)
      .get('/api/leads?status=NEW')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.length).toBe(3);
    expect(filtered.body.pagination.total).toBe(3);

    // Pagination: limit=2, page=1 of the full 6
    const page1 = await request(app)
      .get('/api/leads?limit=2&page=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.pagination.total).toBe(6);
    expect(page1.body.pagination.totalPages).toBe(3);

    const page2 = await request(app)
      .get('/api/leads?limit=2&page=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page2.body.data.length).toBe(2);
    // ensure page1 and page2 don't overlap
    const ids1 = page1.body.data.map((l) => l.id);
    const ids2 = page2.body.data.map((l) => l.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  test('rejects an invalid status filter with 400', async () => {
    const admin = createUser({
      name: 'Ava Admin',
      email: 'ava@invalid.dev',
      password: 'x',
      role: 'admin',
    });
    const res = await request(app)
      .get('/api/leads?status=not_a_real_status')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(400);
  });
});
