# MENA INC. — Wedding Cards & Stationery

Lead-generation storefront + operations admin panel for **Mena INK Trading PLC** (Addis Ababa).
Customers browse the catalog, build an order summary, and send it in one tap via **WhatsApp** or
**Telegram** — no online payment. Every order lands in the database, is delivered to the team on
the chosen channel, and triggers an admin push notification.

## Stack

| Layer    | Tech |
| -------- | ---- |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 · Lucide · Framer Motion |
| Backend  | Node.js · Express · MySQL (`app_records` JSON document table) |
| Delivery | Telegram Bot API · WhatsApp Business Cloud API · Web Push (VAPID) |
| CI/CD    | GitHub Actions (`.github/workflows/deploy.yml`) |

## Getting started

```bash
# 1. Backend
cd server
copy .env.example .env        # fill in MySQL credentials + admin password
npm install
npm run dev                   # http://localhost:4000

# 2. Frontend (second terminal)
cd client
npm install
npm run dev                   # http://localhost:5173 (proxies /api + /uploads)
```

Create the MySQL database first (`CREATE DATABASE mena_inc;`). The server creates the
`app_records` table, the seed admin account (`ADMIN_IDENTIFIER` / `ADMIN_PASSWORD`), default
categories, and homepage content on first boot.

**Admin panel:** `http://localhost:5173/admin`

## Integrations (all optional — the app runs without them)

| Feature | Env vars | How |
| ------- | -------- | --- |
| Telegram delivery | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Create a bot with @BotFather, add it to the team chat, put the chat id here |
| WhatsApp delivery | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEAM_NUMBER` | Meta WhatsApp Business Cloud API app |
| Admin push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys`, then click the bell icon in the admin header on each device |

Unconfigured channels are skipped with a console warning; the order is still saved and visible in
the admin panel.

## Behavior notes

- **Fast loads / offline viewing** — every GET is cached in `localStorage`; cached data renders
  instantly and refreshes in the background. Offline, the site is view-only and shows:
  *"Offline: viewing only. Connect to internet before registering changes in the database."*
- **Database outage** — if the API can't reach MySQL while you're online, a database-connection
  notice is shown and mutations are rejected with a clear error.
- **Photo compression** — all uploads (products, gallery, homepage) are resized to ≤1600px and
  re-encoded to WebP/JPEG **in the browser** before hitting the server, keeping the storefront fast.
- **Pricing modes** — per product: exact price, "starting from", or quote-only.
- **Add-ons** — products flagged as add-ons (entrance cards, schedule cards…) are hidden from the
  main catalog and surfaced as suggestions on product pages and the order summary.
- **Accounts** — email/phone + password, active immediately (no SMS/email verification). Guest
  checkout captures name + phone + optional email; all contacts appear under **Admin → Leads**.

## Data model

Everything is a JSON document in one MySQL table:

```sql
CREATE TABLE app_records (
  id         CHAR(36) PRIMARY KEY,
  collection VARCHAR(64) NOT NULL,   -- products | categories | gallery | orders | leads | users | content | push_subscriptions
  data       JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_collection (collection)
);
```

## API surface (`/api`)

- `GET /health` — DB connectivity probe
- `POST /auth/signup` · `POST /auth/login` · `GET /auth/me`
- `GET /categories` · `GET /products` · `GET /products/:id` · `GET /gallery` · `GET /content/homepage`
- `POST /orders` — persist order/lead, route to WhatsApp/Telegram, push to admins
- Admin (JWT, role=admin): CRUD on `/admin/products|categories|gallery`,
  `GET/PUT /admin/orders`, `GET /admin/leads`, `PUT /admin/content/homepage`,
  `POST /admin/upload`, `GET /admin/push/key`, `POST /admin/push/subscribe`

## Production

`npm run build` in `client/` produces `client/dist`; the Express server serves it automatically
when present, so a single Node process (+ MySQL) runs the whole site. See
`.github/workflows/deploy.yml` for the CI build/package pipeline.
