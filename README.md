# Woods Team Hub

Employee app for Woods Coffee Shop, starting with the allergen matrix.

## Current first slice

- Mobile-first searchable allergen matrix
- Filters for menu category and allergen
- Admin mode with CSV import, add, edit, archive and backup
- Reserved navigation for Training Log, Table Bookings, Employee Handbook and COSHH
- UK 14-allergen labels
- Safety reminder for staff to confirm uncertain orders with a manager
- Secure risk-assessment register with fire, health & safety and HACCP-style food-safety controls
- Review dates, action owners, version snapshots, staff acknowledgement and print/PDF output
- Private Forms & Templates repository with search, categories and mobile-friendly document cards
- Admin multi-file upload, metadata editing, replacement versions and archiving
- Searchable mobile COSHH register with hazard filters, first aid, PPE and spill response
- Admin COSHH loading, editing, review dates, archiving and audit history

## Data

Open **Admin mode** and import the exported allergen CSV. The importer accepts a product/name column, an optional category column, and either individual allergen columns marked with X/Yes/1 or a single Allergens column.

The present browser build stores imported data on the device as a safe preview. Shared staff syncing, authenticated admin access and change history are the next infrastructure step and require a shared database connection.

## Run

Open `index.html` directly, or enable GitHub Pages for this repository.

## Risk assessment setup

Run `supabase-risk-assessments.sql` once in the Supabase SQL Editor. It creates the secure tables, row-level security policies, audit trail and Woods-owned starter assessments. Admins can then refine the controls in the app before approving the next version.

## Forms and templates setup

Run `supabase-documents.sql` once in the Supabase SQL Editor. It creates the document register, version history, audit trail, row-level security and a private 10 MB Supabase Storage bucket. Signed-in staff can open only the current file for an active document; admins can upload, replace, edit or archive documents.

The bulk uploader recognises the supplied FOH, kitchen and toilet checklist filenames and assigns their titles, categories and frequencies automatically.

## COSHH setup

Run `supabase-coshh.sql` once in the Supabase SQL Editor. It creates the COSHH register, review fields, audit history and row-level security. Admins can then select the supplied `COSHH.csv` in the app and use **Import COSHH CSV** to load its 15 products directly into private Supabase storage.
