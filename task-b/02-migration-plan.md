# Task B — Phased migration plan

No big-bang rewrite. Everything ships incrementally, behind tests, with the
app staying live and serving customers throughout.

## Week 1 — stop the bleeding

- Rotate every credential that was in the repo. Move all secrets to environment
  variables / a secrets manager (even a basic one — Doppler, AWS Secrets
  Manager, or the host's built-in env var store). Scrub git history with
  `git filter-repo` (not just a new commit — the old commits still contain them).
- Add a single `.env.example` and a pre-commit hook (`gitleaks` or similar)
  so this can't silently happen again.
- Stand up one authenticated API endpoint for the single highest-risk direct
  frontend→DB call (usually something like "update my profile" or "apply
  discount code" — whatever has write access) and cut the frontend over to
  it. This is the first brick of a real API boundary.
- Write characterization tests for the 2-3 highest-traffic user flows
  (login, checkout, whatever the app's core loop is) against *current*
  behavior, bugs and all. These aren't "correct" tests yet — they're a
  tripwire that fires if week 2+ accidentally changes behavior.

## Month 1 — build the boundary, add the harness

- Migrate the remaining direct-to-DB frontend calls to authenticated API
  endpoints, one flow at a time, each one shipped independently with its
  characterization test added first.
- Once every DB access goes through the API, add a real permission layer
  server-side (the thing that was structurally impossible while the frontend
  talked to the DB directly).
- Set up CI to run the growing test suite on every PR, and block merges on
  failure. This is the point where "no tests" stops being true.
- Start extracting the most duplicated or highest-risk business logic (e.g.
  pricing, auth rules) out of route handlers into plain functions/services,
  one at a time, each backed by a test that existed *before* the extraction.

## Quarter 1 — pay down the rest, and make it stick

- Finish migrating remaining route-handler logic into a service layer,
  prioritized by which routes change most often (that's where the tax is
  highest).
- Raise test coverage on the service layer specifically — that's where bugs
  are cheapest to catch and hardest to see by just reading route handlers.
- Introduce the engineering standards from `04-standards-proposal.md` as
  living lint rules / PR checklist items, not a document nobody rereads.
- Retro: which of these fixes actually reduced incidents/slowed-down feature
  work least? Use that to reprioritize quarter 2.

## Guardrail throughout

Nothing in this plan requires downtime or a cutover weekend. Every step is a
normal deploy, gated by the tests written in the step before it. If a step
can't be shipped without a big-bang moment, it gets broken down further until
it can.
