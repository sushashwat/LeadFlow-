# LeadFlow

A lead management app built for the Digital Heroes Full Stack Development task (Task A).

Public capture form → authenticated CRM with role-based permissions → an
8-stage sales pipeline, notes, and an audit trail. Built to be run by a
small sales team, not just demoed.

**Live app:** https://lead-flow-alpha-teal.vercel.app/
**Live API:** https://leadflow-api-qona.onrender.com
**Repo:** https://github.com/sushashwat/LeadFlow-...
---

## Stack, and why

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + Express | Small, explicit, nothing to explain away in an interview. |
| Database | SQLite, via Node's built-in `node:sqlite` module | Zero setup, no separate DB server. I originally used `better-sqlite3`, but switched to Node's built-in SQLite support after `better-sqlite3` needed a native C++ build step that failed without Visual Studio installed — `node:sqlite` needs no compiling at all and has an almost identical API, so the swap only touched one file. |
| Auth | JWT (stateless) + bcrypt | No session store needed; the token carries `role`, so every request is self-contained. Tradeoff: no server-side revocation before expiry (8h) — a real gap, noted below. |
| Frontend | React + Vite, hand-rolled CSS | No component library needed for this scope; keeps the bundle small and every style decision visible. |
| Tests | Jest + Supertest | Tests hit real HTTP routes against an in-memory database — they exercise the actual permission logic, not a mock of it. |

## Data model

users (id, name, email, password_hash, role[admin|member])
leads (id, name, email, phone, company, message, source,
status, assigned_to -> users.id, created_at, updated_at)
lead_notes (id, lead_id -> leads.id, user_id -> users.id, note, created_at)
activity_log (id, lead_id -> leads.id, user_id -> users.id, action, details, created_at)


`activity_log` is append-only, written by the server on every state change
(create, assign, status change, note added) — never by the client directly.

## Lead pipeline

Eight stages, reflecting an agency sales process rather than a generic
open/closed pipeline:

NEW → CONTACTED → QUALIFIED → NURTURE → PROPOSAL_SENT → NEGOTIATION → WON / LOST


`NURTURE` sits between `QUALIFIED` and `PROPOSAL_SENT` deliberately: a
qualified lead that isn't ready for a proposal right now (bad timing, no
budget yet) needs an honest home that isn't "still qualified" (inaccurate)
or "lost" (gives up on a real opportunity too early). `NEGOTIATION` sits
between `PROPOSAL_SENT` and the two terminal states, because a sent
proposal is rarely accepted as-is — there's usually back-and-forth on price
or scope before it's actually won or dead.

## Permission model

Two roles: **admin** and **member**.

- **Admin**: sees and edits every lead, assigns leads to any user, sees the user list.
- **Member**: sees only leads assigned to them, and can only update a lead's
  `status` — not its name, email, phone, or company. Contact info corrections
  are admin-only: a rep mistyping a client's email is a data-integrity risk
  we don't want left open to everyone with login access. Members also cannot
  assign leads (to themselves or anyone else) or see other members' leads.
- The **public capture endpoint** (`POST /api/public/leads`) requires no auth,
  and can only ever create a lead in `NEW` status with no assignment.

Permissions are enforced **server-side only**. The React app hides admin-only
controls, but that's a UX convenience — every rule is re-checked in Express
middleware / route handlers, and the test suite specifically tries to break
them from the client side (e.g. a member passing another member's ID in a
query param, or trying to edit a lead's email) — see `server/tests/auth.test.js`.

## API contract

Base URL: `http://localhost:4000`. Authenticated routes require
`Authorization: Bearer <token>`.

`POST /api/auth/login` — `{ email, password }` → `{ token, user }`

`POST /api/public/leads` — no auth — `{ name, email, phone?, company?, message? }` → `201 { leadId }`

`GET /api/leads?page=&limit=&status=&assigned_to=&search=` — members always
scoped server-side to their own leads regardless of `assigned_to` passed.

`GET /api/leads/:id` · `PATCH /api/leads/:id` — admins may send
`{ status, name, email, phone, company }`; members may only send `{ status }`,
other fields silently ignored.

`PATCH /api/leads/:id/assign` — admin only — `{ assigned_to }`

`GET/POST /api/leads/:id/notes` · `GET /api/leads/:id/activity`

`GET /api/users` — admin only

## Running locally

```bash
cd server
npm install
npm run seed     # admin@leadflow.dev / AdminPass123!
                  # member@leadflow.dev / MemberPass123!
npm run dev       # http://localhost:4000

cd client         # second terminal
npm install
npm run dev       # http://localhost:5173
```

## Tests

```bash
cd server
npm test
```

15 tests: login correctness, route protection, cross-member data isolation
(including the contact-info restriction), and the two core flows — full
lead lifecycle and pagination/filtering.

## Known gaps

- JWTs can't be revoked before they expire (8h). Next step would be a
  refresh-token flow or a token-version column on `users`.
- No rate limiting yet on `/api/auth/login` or the public capture endpoint.
- `node:sqlite` is still an experimental Node API as of this writing — fine
  for this scope, but I'd re-evaluate before using it in a larger production system.
- Deployed on Render's free tier, which spins down after 15 minutes idle —
  the first request after a gap has a 15-30s cold-start delay while it wakes
  back up. A paid tier or a scheduled keep-alive ping would fix this.

## AI usage disclosure

I used Claude to scaffold the initial Express/React structure, the JWT auth
middleware, and the base test suite. I made several changes after that:
redesigned the lead pipeline from a generic 6-stage list to an 8-stage one
adding NEGOTIATION and NURTURE, since I didn't want leads with just bad
timing to look the same as dead ones. I also restricted contact-info edits
to admins only after deciding a rep mistyping a client's email was a real
risk I didn't want left open to every member — that required a permission
change in the PATCH route plus a new test proving the restriction actually
works, which I wrote and confirmed passes (15/15). I also hit a Visual
Studio build error on `better-sqlite3` partway through and switched to
Node's built-in SQLite module myself to fix it without needing to install
a multi-gigabyte compiler toolchain. Visual design (terracotta/slate
palette, header treatment) was my own choice after comparing a few options.