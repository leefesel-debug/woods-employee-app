# Woods Team Hub V2 stabilisation

## Goal

Make future Woods Hub releases safer without changing the live team's current workflow or production data.

## Guardrails

1. `main` is production. Do not use it for experiments.
2. V2 work stays on `v2-stabilisation` until the smoke-test gate passes.
3. No production Supabase schema/data migration is required merely to clean the front-end repository.
4. Preserve current table names, IDs, audit history and row-level-security behaviour during stabilisation.
5. Release/version changes are deliberate and separate from feature changes.
6. Git history, not duplicate numbered files in the working tree, is the rollback archive.

## Phase 1 — repository clean-up

- Document the actual current architecture.
- Remove obsolete `v7`–`v15` HTML/JavaScript release copies from the V2 branch after confirming the current entry point only uses V16.
- Remove duplicate legacy `app.js` once no active page references it.
- Retain V16, feature modules, Supabase scripts, current app icons and COGS files.
- Keep test utilities only where they still serve an explicit test purpose.

## Phase 2 — release and cache simplification

Current Build 39 has several version signals: the index redirect, manifest start URL, page build number, `version.json`, and JavaScript query strings. This worked during rapid prototyping but creates opportunities for partial deployments and refresh loops.

V2 target:

- one canonical app entry point;
- one release/build constant;
- asset cache-busting generated from that release;
- no automatic redirect loop while a signed-in user is using the app;
- update prompt or controlled refresh rather than forced repeated navigation;
- preserve Supabase auth/session storage across ordinary releases.

This phase must be tested on the V2 branch before any production merge.

## Phase 3 — code ownership

Move compatibility patches and feature behaviour out of `config.js` over time. `config.js` should ultimately be configuration only. Allergen behaviour belongs in an allergen module; auth/recovery belongs in auth/core; home/admin additions belong in their owning modules.

Do this incrementally and preserve behaviour after each move.

## Production smoke-test gate

Before V2 can be considered for `main`, test on iPhone Safari and installed Home Screen/PWA where applicable:

- Existing staff can sign in and remain signed in after close/reopen.
- Sign out and sign back in works.
- Forgot-password control opens the recovery flow without breaking normal sign-in.
- Admin and non-admin permissions render correctly.
- Allergen register loads shared records.
- Search/category/allergen/dietary filters work, including Vegetarian.
- Recently added and recently changed sorting works.
- Add, edit and archive an allergen test record; confirm persistence after reload.
- Wheat/Rye/Barley/Oats/Spelt/Khorasan persist.
- Vegan implies Vegetarian; non-vegan existing records can remain Not confirmed.
- Product info / may-contain text displays on the main card.
- Table booking create/read/update behaviour works.
- Training records load; due/overdue status and refresher flow work.
- Risk assessments and acknowledgements load.
- Forms & Templates open correctly.
- COSHH register loads.
- Supplier order can be prepared; secure-send flow is tested only with an intentional test order.
- Complaints, accidents and key contacts load.
- Activity log loads for admin.
- COGS opens for admin and ingredient edits persist.
- Closing/reopening the app does not flash, loop or force an unexpected sign-out.

## Rollback

Do not use old numbered files as the rollback mechanism. Tag or record the known-good production commit before promotion. If a release fails, move production back to that known-good commit rather than layering emergency version redirects on top of the failed release.

## Next functionality after stabilisation

Once the foundation is stable, the next product phase is expected to focus on:

1. Today at Woods dashboard
2. Digital opening/closing/temperature/cleaning checks
3. Tasks and actions
4. Deeper Orders + COGS + stock/waste linkage
5. Management dashboard and staff acknowledgements
