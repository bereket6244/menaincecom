# MENA INC. - Wedding Cards & Stationery

Lead-generation storefront and operations admin panel for **Mena INK Trading PLC** in Addis Ababa.
Customers browse the catalog, build an order summary, and send it in one tap via **Telegram**,
**WhatsApp**, or **SMS**. There is no online payment. Every order is saved, delivered to the team on
the chosen channel, and can trigger an admin push notification.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide, Framer Motion |
| Backend | Node.js, Express, MySQL `app_records` JSON document table, local JSON fallback |
| Delivery | Telegram Bot API, WhatsApp Business Cloud API, Web Push VAPID |
| CI/CD | GitHub Actions, cPanel Fileman API, cPanel Passenger/Application Manager |

## Getting Started

```bash
# Backend
cd server
copy .env.example .env
npm install
npm run dev

# Frontend, second terminal
cd client
npm install
npm run dev
```

Local URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
Admin:    http://localhost:5173/admin
```

Create the MySQL database first when using MySQL:

```sql
CREATE DATABASE mena_inc;
```

The server creates the `app_records` table, the seed admin account, default categories, and homepage
content on first boot. If MySQL is unavailable or `USE_LOCAL_STORE=true`, the app uses
`server/dev-data.json`.

## Environment

Important backend variables:

```text
PORT=4000
APP_BASE_PATH=/shop
CLIENT_DIST_DIR=/home/<cpanel-user>/public_html/shop
JWT_SECRET=<strong-secret>
CORS_ORIGIN=https://menaincet.com

DB_HOST=localhost
DB_PORT=3306
DB_USER=<mysql-user>
DB_PASSWORD=<mysql-password>
DB_NAME=mena_inc
USE_LOCAL_STORE=false

ADMIN_IDENTIFIER=<seed-admin-email>
ADMIN_PASSWORD=<strong-seed-password>
ADMIN_NAME=<seed-admin-name>
```

Optional integrations:

| Feature | Env vars |
| --- | --- |
| Telegram delivery | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| WhatsApp delivery | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEAM_NUMBER` |
| Admin push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

Unconfigured delivery channels are skipped with a console warning. Orders are still saved and visible
in the admin panel.

## Behavior Notes

- **Offline viewing**: GET responses are cached in `localStorage`; cached data renders immediately and
  refreshes in the background.
- **Database outage**: database failures return clear `503` responses that the frontend can show as a
  database-connection notice.
- **Photo compression**: product, gallery, category, and homepage uploads are resized in the browser to
  a maximum dimension of 1200px and re-encoded to WebP first, with JPEG fallback.
- **Subpath media URLs**: uploaded media is stored as `/uploads/...` and normalized client-side to
  `/shop/uploads/...` in production so images display when the app is mounted under `/shop`.
- **Admin creation**: only an authenticated current admin can create another admin. New admin passwords
  must be at least 14 characters and include uppercase, lowercase, a number, and a symbol.
- **Pricing modes**: products can have exact price, starting price, or quote-only pricing.
- **Add-ons**: add-on products are hidden from the main catalog and surfaced as suggestions on product
  pages and the order summary.
- **Complimentary items**: admins can attach free items to products directly, or create reusable
  universal complimentary items and enable them per product. Free quantities can be fixed or a
  multiplier of the main item quantity, capped at 2.5x. Customers start at `0`, choose how many free
  items they want, and any quantity above the allowed free amount is priced with the admin-set extra
  price.
- **Product variants and photos**: products can have multiple photos and optional variant attributes
  such as color or size. Variant values participate in catalog filtering and product detail
  selections.
- **Category photos**: admins can upload category profile photos, and customers see them in the
  storefront category experience.
- **Accounts**: customers can sign up with email or phone plus password. Guest checkout captures name,
  phone, and optional email.

## Data Model

Everything is a JSON document in one MySQL table:

```sql
CREATE TABLE app_records (
  id CHAR(36) PRIMARY KEY,
  collection VARCHAR(64) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_collection (collection)
);
```

Collections include:

```text
products, categories, complimentary_items, gallery, orders, leads, users, content, push_subscriptions
```

## API Surface

Public:

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/categories`
- `GET /api/complimentary-items`
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/gallery`
- `POST /api/orders`

Admin only:

- `GET /api/admin/users/admins`
- `POST /api/admin/users/admins`
- CRUD on `/api/admin/products`, `/api/admin/categories`, `/api/admin/complimentary-items`,
  `/api/admin/gallery`
- `GET /api/admin/orders`
- `PUT /api/admin/orders/:id`
- `GET /api/admin/leads`
- `POST /api/admin/upload`
- `GET /api/admin/push/key`
- `POST /api/admin/push/subscribe`

## Production

The live site is mounted at:

```text
https://menaincet.com/shop
```

Build the frontend for that subpath:

```bash
cd client
VITE_APP_BASE_PATH=/shop npm run build
```

For cPanel Passenger/Application Manager:

- App root: `/home/<cpanel-user>/mena-shop-app-v2/server`
- Startup file: `app.js`
- Base URI: `/shop`
- Node: cPanel-provided Node 20

The Express app serves both the API and the built frontend. In the current cPanel setup,
`CLIENT_DIST_DIR` points to `/home/<cpanel-user>/public_html/shop`, and `/shop/uploads/...` is served
from the Node app upload directory.

## GitHub Actions Deploy

`.github/workflows/deploy.yml` builds the Vite frontend for `/shop`, packages `client/dist`, uploads it
to cPanel using Fileman, extracts it into the target directory, and verifies the live `/shop` URLs.

Required repository secrets:

```text
CPANEL_HOST
CPANEL_USER
CPANEL_TOKEN
CPANEL_TARGET_DIR
```

Optional:

```text
CPANEL_SERVER_DIR
```

If `CPANEL_SERVER_DIR` is not set, the deploy workflow derives it from `CPANEL_TARGET_DIR` by using
`/home/<cpanel-user>/mena-shop-app-v2/server` when the target directory is under `public_html`.

Do not commit cPanel tokens, GitHub tokens, SSH private keys, seed passwords, or production `.env`
files.
