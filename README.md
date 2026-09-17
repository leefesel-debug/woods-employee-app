# Woods Team Hub

Employee app for Woods Coffee Shop, starting with the allergen matrix.

## Current first slice

- Mobile-first searchable allergen matrix
- Filters for menu category and allergen
- Admin mode with CSV import, add, edit, archive and backup
- Reserved navigation for Training Log, Table Bookings, Employee Handbook and COSHH
- UK 14-allergen labels
- Safety reminder for staff to confirm uncertain orders with a manager

## Data

Open **Admin mode** and import the exported allergen CSV. The importer accepts a product/name column, an optional category column, and either individual allergen columns marked with X/Yes/1 or a single Allergens column.

The present browser build stores imported data on the device as a safe preview. Shared staff syncing, authenticated admin access and change history are the next infrastructure step and require a shared database connection.

## Run

Open `index.html` directly, or enable GitHub Pages for this repository.
