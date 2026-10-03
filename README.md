# Woods Team Hub

Woods Team Hub is the mobile-first operating hub for Woods Coffee Shop. The production app is served from the `main` branch. Development and stabilisation work must be completed on a separate branch and tested before it is promoted to `main`.

## Current production capabilities

- Shared Supabase authentication and staff sign-in
- Self-service password recovery
- Shared allergen register with add/edit/archive, dietary flags, specific gluten cereals, product information and audit history
- Table bookings
- Staff handbook
- Training log with requirements, completion history, refresher dates and due/overdue status
- Risk assessments with review dates, versions, actions, staff acknowledgement and print/PDF output
- Forms & Templates repository with private file storage and version history
- COSHH register with hazards, PPE, first aid, spill response, review dates and audit history
- Supplier ordering with catalogues, order history and secure Woods mailbox sending
- Key contacts, complaints and accident records
- Administrator activity/audit log across operational modules
- Administrator Cost of Goods tools

## Architecture

The current user interface is `v16.html`, with core behaviour in `app-v16.js` and feature modules in:

- `activity-v1.js`
- `orders-v1.js`
- `risk-v1.js`
- `documents-v1.js`
- `coshh-v1.js`
- `training-v1.js`
- `operations-v1.js`

`config.js` contains runtime configuration plus several compatibility/enhancement hooks added during the first live iteration. One objective of V2 stabilisation is to move feature logic out of configuration and into clear feature modules without changing live behaviour.

Supabase is the shared system of record. SQL setup/migration files are retained in the repository, and the supplier-order Edge Function lives under `supabase/functions/send-supplier-order/`.

## Release rule

**`main` = live and stable.**

Do not experiment directly on `main`. New work should be developed on a branch, checked against the smoke-test list in `STABILISATION.md`, and only then promoted deliberately.

The current production release is Build 39. `index.html`, `manifest.webmanifest`, `version.json`, `v16.html` and the JavaScript asset query strings currently participate in launch/version behaviour. Treat changes to those files as release changes rather than routine feature changes.

## V2 stabilisation

The `v2-stabilisation` branch is being used to simplify the repository and establish a safer release process before the next major functionality is added. See `STABILISATION.md` for scope, risks and test gates.

## Supabase setup files

The repository contains setup scripts for activity, bookings, COGS, COSHH, documents, handbook, operations, orders, risk assessments and training. These scripts should not be rerun against production unless the change being applied is understood and deliberately required.

## Local / Pages use

The production entry point is `index.html`, which launches the current application. GitHub history is the archive for previous releases; old numbered HTML/JavaScript copies do not need to remain in the working tree once V2 clean-up is complete.
