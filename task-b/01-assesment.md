# Task B — Assessment: inheriting a live, poorly-built codebase

**Scenario:** a working app serving real customers, with no tests, business
logic embedded in route handlers, direct database calls from the frontend,
and secrets committed to the repo. It cannot go down.

## Fix order, and why

The order is driven by one question: *what is the blast radius if this stays
broken one more week?* — not by what's most annoying to look at.

| Priority | Issue | Risk of leaving it | Why this order |
|---|---|---|---|
| 1 | Secrets in the repo | Anyone with repo access (past or present contributors, a leaked clone, a public repo mistake) has production credentials. This is the only item that's a live, standing security incident, not just technical debt. | Rotate and remove first, same day. Everything else can wait a sprint; this can't. |
| 2 | Frontend calling the database directly | This means the frontend either holds DB credentials (catastrophic if the bundle is ever inspected) or hits an unauthenticated internal DB proxy. Either way, there is no server-side place to enforce *any* permission rule — it's not just messy, it's a standing authorization hole. | Fix second because it's both a security and correctness issue, and every other refactor is easier once there's a real API boundary to refactor *behind*. |
| 3 | No tests | Nobody can safely touch anything else on this list without a way to know they didn't break checkout, auth, or billing. | Fix third — write characterization tests around the current (even if wrong) behavior of the highest-traffic paths *before* touching their code, so refactors 4 and 5 have a safety net. |
| 4 | Business logic in route handlers | Makes the app hard to test, hard to reuse logic (e.g. the same discount rule needed in two places), and hard to reason about. Real but not urgent — it's a productivity tax, not an incident. | Fix last, incrementally, module by module, using the tests from step 3 as the harness. |

## Why not "rewrite it properly"

A rewrite guarantees months of zero feature velocity and a high-stakes cutover
on a system serving real customers. Every item above can be fixed in place,
behind tests, without a big-bang cutover — see the phased plan in
`02-migration-plan.md`.
