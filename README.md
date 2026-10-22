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

### Google customer login

The shop uses Google Identity Services with the public Mena Storefront web client ID.
`GOOGLE_CLIENT_ID` can override it on the server; no client secret is used. The browser
loads the client ID and a short-lived, browser-bound nonce from `/api/auth/google/config`.
The server verifies Google's signature, issuer, audience, expiry and nonce before issuing
the normal shop session. New Google accounts are customers only. Existing password users
must log in first and connect a Google account with the same email on `/account`.

Google Console must allow `https://menaincet.com` as a JavaScript origin. For local
testing also allow `http://localhost` and `http://localhost:5173`. No redirect URI is
needed for the JavaScript callback flow. Guestlink is not integrated by this change;
sharing its sessions requires integration with that app's authentication code.

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
| Telegram product sync | `TELEGRAM_SYNC_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_CHANNEL_USERNAME`, `PUBLIC_SHOP_URL` |
| WhatsApp delivery | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEAM_NUMBER` |
| Admin push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

Unconfigured delivery channels are skipped with a console warning. Orders are still saved and visible
in the admin panel.

## Behavior Notes

### Editing the storefront ad

Open **Admin → Storefront Ad** (`/admin/storefront-ad`). This controls the strip below
the storefront navigation on mobile and desktop.

1. Enter an optional small label (30 characters), headline (80), optional supporting text (120), button text (20),
   and destination (500). Use a shop path such as `/digital-invitations` or a full HTTPS URL.
   Leave the small label blank to omit it. The ad uses no decorative icon.
2. Check the mobile and desktop previews. Supporting text appears on wide desktop screens.
3. Click **Publish ad**, then use **View storefront** to check the result.
4. To remove the strip, turn off **Show ad on the storefront** and click **Save hidden ad**.
   The text is retained for reuse. **Discard changes** restores the last loaded or saved ad.

Edits remain in the current browser form until saved; there is no separate persisted draft or schedule.
The standard content contract is `storefrontAd: { enabled, label, title, description, buttonText, href }`
inside business content. Admin editors send only their own fields to the authenticated
`PUT /api/admin/content/business` endpoint. The server validates ad text limits and links,
and the frontend invalidates its business-content cache after saving. Both storefront layouts
and the previews use the same `AdStrip` component. Refresh an already-open storefront tab
to see newly published content.

### Storefront image delivery

Uploaded JPEG, PNG, WebP, and AVIF photos are served through `/api/image` in
320/640/960/1280px WebP variants. The browser selects a size for the displayed
card or photo. The server preserves originals and caches generated variants in
`server/.image-cache` (the app process needs write access there); browsers cache
variants for 30 days. Image conversion is limited to two concurrent jobs.
If conversion is unavailable, photos fall back to the original upload.
External images and GIFs retain their original URLs.

Product cards load the current photo first and only warm adjacent photos when
the shopper interacts. Photo changes show a loading indicator and a retry button
on failure. Catalog, product details, and digital invitations ship with the main
storefront bundle to avoid an extra page-code download after tapping a link.
Deploy the server dependency update alongside the client to enable resizing.

- **Desktop storefront**: the desktop catalog, product detail, cart, checkout, and order-ready screens
  use the Boutique desktop redesign from `design_handoff_mena_mobile_storefront desktop`. Desktop has
  a white header, blush search band, circular category rail, sticky filter sidebar, independent product
  grid scrolling, Telegram-first checkout channel selection, and the fixed Amount/Total/Place order
  bar.
- **Mobile storefront**: mobile keeps the mobile Boutique flow with hamburger navigation, sheets,
  sticky purchase bars, and mobile cart/checkout behavior.
- **Buttons**: customer-facing primary actions use filled pink buttons with white text; secondary
  actions use pink outlines with pink text.
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
- **Pricing modes**: products can have an exact price, starting price, progressive quantity tiers, or quote-only pricing. Progressive tiers charge each quantity range at its own rate and show customers the blended average unit price for their selected quantity.
- **Telegram product sync**: when enabled, publishing a product creates a channel post, and later
  published product edits update the existing Telegram message caption/text with current price,
  details, variant options, hashtags, and the storefront link.
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
- **Accounts**: customers can sign up with a verified email and password or use Google sign-in.
  Existing phone-based accounts can still log in. Guest checkout captures name, phone, and optional email.
- **Email verification**: password-based customer signup requires a six-digit email code before the
  account is created. Codes expire after 10 minutes, resend requests have a one-minute cooldown, and
  five incorrect attempts invalidate the code. Configure the `SMTP_*` and
  `EMAIL_VERIFICATION_SECRET` variables shown in `server/.env.example`.

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
to cPanel using Fileman, deploys the Passenger server bundle, installs server dependencies, warms the
app, and verifies the live `/shop` URLs.

Required repository secrets:

```text
CPANEL_USER
CPANEL_TOKEN
CPANEL_TARGET_DIR
```

Optional:

```text
CPANEL_URL
CPANEL_HOST
CPANEL_PORT
CPANEL_SERVER_DIR
```

Endpoint rules:

- Prefer `CPANEL_URL=https://cpanel.menaincet.com:2083`.
- If `CPANEL_URL` is empty, set `CPANEL_HOST=cpanel.menaincet.com` and `CPANEL_PORT=2083`.
- The workflow trims accidental protocols/paths from `CPANEL_HOST`, validates DNS before upload, and
  falls back to `https://cpanel.menaincet.com:2083` if an older bad host secret is still present.

If `CPANEL_SERVER_DIR` is not set, the deploy workflow derives it from `CPANEL_TARGET_DIR` by using
`/home/<cpanel-user>/mena-shop-app-v2/server` when the target directory is under `public_html`.

Do not commit cPanel tokens, GitHub tokens, SSH private keys, seed passwords, or production `.env`
files.
