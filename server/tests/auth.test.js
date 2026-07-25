const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { createUser, tokenFor, resetDb } = require('./helpers');

beforeEach(() => resetDb());

describe('POST /api/auth/login', () => {
  test('logs in with correct credentials and returns a JWT', async () => {
    createUser({
      name: 'Ava Admin',
      email: 'ava@test.dev',
      password: 'correcthorse',
      role: 'admin',
    });
    // password stored via bcrypt hash in helper uses raw password 'correcthorse'
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ava@test.dev', password: 'correcthorse' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  test('rejects wrong password with 401', async () => {
    createUser({
      name: 'Ava Admin',
      email: 'ava2@test.dev',
      password: 'correcthorse',
      role: 'admin',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ava2@test.dev', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('rejects unknown email with 401 (not 404, to avoid user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  test('rejects malformed input with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('Route protection', () => {
  test('protected route rejects requests with no token', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });

  test('protected route rejects a garbage token', async () => {
    const res = await request(app)
      .get('/api/leads')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('member is blocked (403) from admin-only /api/users', async () => {
    const member = createUser({
      name: 'Max Member',
      email: 'max@test.dev',
      password: 'x',
      role: 'member',
    });
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(member)}`);
    expect(res.status).toBe(403);
  });

  test('admin can access admin-only /api/users', async () => {
    const admin = createUser({
      name: 'Ava Admin',
      email: 'ava3@test.dev',
      password: 'x',
      role: 'admin',
    });
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('member is blocked (403) from assigning a lead', async () => {
    const member = createUser({
      name: 'Max Member',
      email: 'max2@test.dev',
      password: 'x',
      role: 'member',
    });
    const lead = db
      .prepare(
        "INSERT INTO leads (name, email, source, status) VALUES ('Lead X','x@x.com','website','new')"
      )
      .run();

    const res = await request(app)
      .patch(`/api/leads/${lead.lastInsertRowid}/assign`)
      .set('Authorization', `Bearer ${tokenFor(member)}`)
      .send({ assigned_to: member.id });

    expect(res.status).toBe(403);
  });
});

describe('Data isolation between members', () => {
  test("a member cannot view a lead assigned to someone else", async () => {
    const memberA = createUser({
      name: 'Member A',
      email: 'a@test.dev',
      password: 'x',
      role: 'member',
    });
    const memberB = createUser({
      name: 'Member B',
      email: 'b@test.dev',
      password: 'x',
      role: 'member',
    });

    const lead = db
      .prepare(
        `INSERT INTO leads (name, email, source, status, assigned_to)
         VALUES ('Lead Y','y@y.com','website','new', ?)`
      )
      .run(memberA.id);

    const resOwn = await request(app)
      .get(`/api/leads/${lead.lastInsertRowid}`)
      .set('Authorization', `Bearer ${tokenFor(memberA)}`);
    expect(resOwn.status).toBe(200);

    const resOther = await request(app)
      .get(`/api/leads/${lead.lastInsertRowid}`)
      .set('Authorization', `Bearer ${tokenFor(memberB)}`);
    expect(resOther.status).toBe(403);
  });

  test('list endpoint scopes a member to only their assigned leads, even if they request otherwise', async () => {
    const memberA = createUser({
      name: 'Member A',
      email: 'a2@test.dev',
      password: 'x',
      role: 'member',
    });
    const memberB = createUser({
      name: 'Member B',
      email: 'b2@test.dev',
      password: 'x',
      role: 'member',
    });

    db.prepare(
      `INSERT INTO leads (name, email, source, status, assigned_to) VALUES ('L1','l1@x.com','website','new', ?)`
    ).run(memberA.id);
    db.prepare(
      `INSERT INTO leads (name, email, source, status, assigned_to) VALUES ('L2','l2@x.com','website','new', ?)`
    ).run(memberB.id);

    // memberA tries to request memberB's leads via query param - should be ignored server-side
    const res = await request(app)
      .get(`/api/leads?assigned_to=${memberB.id}`)
      .set('Authorization', `Bearer ${tokenFor(memberA)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('L1');
  });
});
