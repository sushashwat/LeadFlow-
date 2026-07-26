# Task B — Refactor: before/after commentary

Full code in `refactor-demo/before.js` and `refactor-demo/after.js`. Both are
samples I wrote myself to demonstrate the "business logic in route handlers"
pattern described in the brief — not lifted from a real client's codebase.

## The core move

Everything that isn't "parse the HTTP request" or "return the HTTP response"
moved out of the route handler into a pure function (`applyDiscount` and its
helpers). Pure means: given the same inputs, always the same output, no
database call, no `req`/`res` in sight.

## Why this is the highest-leverage refactor for this scenario

- **Testability**: the "before" version requires a running Express app and a
  seeded database to test a single discount rule. The "after" version tests
  that rule with two plain JavaScript objects and no setup. That's the
  difference between a team that writes tests and a team that says they will.
- **Reviewability**: a PR that changes VIP eligibility now touches one 4-line
  function, not a diff inside a 35-line handler where the fraud cap rule sits
  20 lines below the code it silently overrides.
- **Reuse**: if a future feature needs to preview a discount before applying
  it (e.g. show the customer their discounted price before checkout), the
  "before" version means either duplicating the logic or awkwardly calling
  the route handler internally. The "after" version means importing
  `applyDiscount` and calling it — that's the whole feature.

## What I deliberately did not change

I didn't touch the database access pattern (`db.getOrderById` etc. are still
simple query wrappers) or introduce a new framework/ORM. The task is to show
one concrete, honest refactor — not to redesign the whole data layer in the
same diff. Bundling an unrelated architectural change into "the discount fix"
is exactly the kind of scope creep that makes refactors risky to review and
risky to ship.
