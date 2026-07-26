# Task B — Engineering standards proposal

The goal here isn't a style guide nobody reads. It's a short list of rules
tied directly to the three problems we just fixed, enforced by tooling where
possible so adoption doesn't depend on willpower.

## The standards

1. **No business logic in route/controller handlers.**
   A handler may parse input, call one service function, and shape the
   response. If a handler has an `if` statement that isn't about validation
   or HTTP status codes, that logic belongs in a service function.
   *Enforced by:* PR template checklist item + code review; longer term, an
   ESLint rule capping handler function length/complexity.

2. **No frontend code talks to the database directly.**
   All data access goes through an authenticated API endpoint. This is a
   security boundary, not a style preference — it's the only place
   permissions can actually be checked.
   *Enforced by:* the frontend build has no DB client library in its
   dependencies at all, so this is a `package.json` diff away from being
   caught in review.

3. **No secrets in the repo, ever — including in history.**
   All credentials live in environment variables or a secrets manager.
   *Enforced by:* a pre-commit hook (`gitleaks` or equivalent) that blocks
   commits containing credential-shaped strings, plus a documented rotation
   procedure if one ever leaks anyway.

4. **New business logic ships with a test.**
   Not "100% coverage" as a vanity metric — specifically, any new pure
   function encoding a business rule (pricing, eligibility, permissions)
   ships with at least one test proving the rule does what it claims.
   *Enforced by:* CI blocks merge if the diff adds a new file under
   `services/` with no corresponding test file.

## Getting a resistant team to actually adopt this

Two failure modes kill standards like these: they show up as a document
nobody reads, or they show up as review nitpicking that feels arbitrary and
slows people down without visible benefit. The way around both:

- **Only formalize rules the team just got burned by.** These four standards
  map directly to the secrets leak, the DB-access hole, and the discount bug
  from the refactor exercise — not abstract best practice. That's the pitch:
  "here's the incident, here's the one-line rule that would have caught it,"
  not "here's a 40-item style guide."
- **Automate enforcement wherever possible so it isn't personal.** A linter
  flagging handler complexity is a fact, not John's opinion in a PR comment.
  Standards that live only in human review erode the first time someone's
  under deadline pressure; standards that live in CI don't.
- **Introduce one at a time, starting with the secrets hook** — it's the
  lowest-friction (nobody's workflow changes unless they were about to commit
  a secret) and the highest-consequence, so it earns trust fast with minimal
  cost. Once that one lands without drama, the team is more receptive to the
  next.
- **Exempt existing code from day one, not new code.** Nobody adopts a
  standard that's introduced as "now go fix 200 existing violations." Lint
  rules apply to changed lines only at first; the migration plan handles the
  backlog on its own schedule.
