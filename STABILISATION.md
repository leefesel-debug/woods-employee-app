# Woods Team Hub V2 stabilisation

## Goal

Make future Woods Hub releases safer without changing the live team's current workflow or production data.

## Current status

- Phase 1 repository clean-up: complete on `v2-stabilisation`.
- Phase 2 release/cache simplification: first stabilisation pass complete.
- Production `main`: unchanged.
- Automated static release checks: enabled for pushes to `v2-stabilisation` and pull requests to `main`.
- First automated validation run: passed.
- Manual iPhone / installed-app smoke test: still required before any production merge.

## Guardrails

1. `main` is production. Do not use it for experiments.
2. V2 work stays on `v2-stabilisation` until the smoke-test gate passes.
3. No production Supabase schema/data migration is required merely to clean the front-end repository.
4. Preserve current table names, IDs, audit history and row-level-security behaviour during stabilisation.
5. Release/version changes are deliberate and separate from feature changes.
6. Git history, not duplicate numbered files in the working tree, is the rollback archive.

## Phase 1 — repository clean-up

Completed on the V2 branch:

- Documented the current architecture.
- Removed obsolete `v7`–`v15` HTML/JavaScript release copies after confirming the current entry point uses V16.
- Removed duplicate legacy `app.js`.
- Retained V16, feature modules, Supabase scripts, current V2 app icons and COGS files.
- Removed superseded first-generation app icons.

## Phase 2 — release and cache simplification

Build 39 had several version signals: the index redirect, manifest start URL, page build number, `version.json`, and JavaScript query strings. This worked during rapid prototyping but created opportunities for partial deployments and refresh loops.

First V2 stabilisation pass completed:

- `index.html` is the stable public entry point.
- Removed the duplicate HTML meta refresh from `index.html`; entry now performs one controlled redirect to the current app page.
- Entry redirect preserves query parameters and URL fragments so authentication/recovery callback data is not discarded.
- Installed-app `start_url` now points to the stable root entry rather than a numbered build URL.
- Legacy automatic version navigation is disabled by removing the redirect URL from `version.json`; the existing V16 checker can therefore no longer force a user to another page.
- Existing Supabase auth/session implementation and production data structures remain unchanged.
- Added `scripts/validate-release.mjs` to guard the release structure.
- Added GitHub Actions validation for V2 pushes and pull requests to `main`.

Remaining Phase 2 work is deliberately limited until device testing: remove the now-redundant V16 version-check code and consolidate residual asset version strings only after the branch has passed the real iPhone/PWA smoke test.

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

## Automated checks

`node scripts/validate-release.mjs` checks that:

- required current files and feature modules exist;
- obsolete numbered V7–V15 app files have not returned;
- the entry point has no meta-refresh loop;
- auth query/hash data is preserved by the entry redirect;
- the PWA starts from the stable root;
- the legacy forced version redirect remains disabled;
- V16 still references all expected feature modules.

These checks reduce release risk but do not replace the manual signed-in device smoke test.

## Rollback

Do not use old numbered files as the rollback mechanism. Tag or record the known-good production commit before promotion. If a release fails, move production back to that known-good commit rather than layering emergency version redirects on top of the failed release.

## Next functionality after stabilisation

Once the foundation is stable, the next product phase is expected to focus on:

1. Today at Woods dashboard
2. Digital opening/closing/temperature/cleaning checks
3. Tasks and actions
4. Deeper Orders + COGS + stock/waste linkage
5. Management dashboard and staff acknowledgements
