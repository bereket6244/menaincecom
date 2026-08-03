# Telegram Product Migration: Inspection and Plan

## Inspection scope

- Source export: `ChatExport_2026-08-03/messages.html` plus exported media.
- The source export is read-only and excluded from Git.
- Website: React 19 with Vite, backed by Express 4 and MySQL through `mysql2`.
- Hosting: cPanel/Passenger under `/shop`; long-running workers should not be assumed.
- Production data visible through the public API: five products and one active category, `Wedding Invitations`.

## Telegram export summary

- Export format: Telegram Desktop HTML, not JSON.
- Channel title: `Mena Wedding catalogue`.
- Public username: `menaweddingcatalogue`.
- Message IDs are encoded in HTML element IDs such as `message203`.
- Timestamps include a numeric UTC offset, for example `03.08.2026 12:00:00 UTC+03:00`.
- Media paths are relative links into `photos/` and `video_files/`.
- The export contains 163 channel messages, 159 photo references, and three video references.
- HTML does not contain the numeric Telegram Channel ID or authoritative media-group IDs.
- Possible albums can only be inferred conservatively from consecutive media messages with identical timestamps and at most one caption.
- Two messages are replies. Service messages include dates, channel creation, and pinned-message events.
- Captions range from short single-line title/price entries to structured captions with tags, colors, sizes, availability, complimentary items, and multiple price tiers.

## Website architecture summary

- Products are JSON documents stored in the `app_records` table under the `products` collection.
- Current product fields are `name`, `categoryId`, `description`, `photos`, `pricingMode`, `price`, `variants`, `isAddon`, `suggestedAddonIds`, `complimentaryItems`, `universalComplimentaryItemIds`, and `featured`.
- Product images are uploaded under `server/uploads` and served by the Express application.
- Product create/update/delete uses a generic CRUD route. There is no publish status, soft deletion, event outbox, background queue, or platform mapping model.
- Existing Telegram and WhatsApp functions send order notifications. They are not Channel publication integrations and should remain separate.

## Database summary and proposed additions

The current schema has one generic table:

```sql
app_records(id CHAR(36), collection VARCHAR(64), data JSON, created_at, updated_at)
```

Synchronization needs relational identity and retry guarantees that are difficult to enforce inside JSON. Proposed dedicated tables are:

- `import_batches`: one row per inspected or imported export.
- `import_records`: one row per Telegram message or inferred album representative.
- `product_channel_posts`: product-to-platform external identity and synchronized version.
- `sync_events`: transactional outbox with unique event UUID, content version, retry state, and next-attempt time.
- `sync_audit_log`: sanitized immutable operation history.

No migration will be applied until the SQL has been reviewed and a production backup is confirmed.

## Telegram-to-product mapping

| Telegram data | Website/import field | Rule |
| --- | --- | --- |
| Public username | `channel_identifier` | Store `menaweddingcatalogue`; resolve numeric ID through the bot later. |
| Message element ID | `external_message_id` | Parse the number from `messageNNN`. |
| Message timestamp | `original_published_at` | Convert while preserving the `+03:00` offset. |
| First valid title-like line | `name` | Remove a trailing ETB/birr amount; reject price-only, availability, size, and complimentary-item lines. |
| One ETB/birr amount | `price` + `pricingMode=exact` | Parse as a non-negative number. |
| Multiple amounts | `priceCandidates` + proposed `pricingMode=starting` | Use the lowest amount only as a proposal and require review. |
| No amount | `pricingMode=quote` | Require review; do not invent a price. |
| Full caption | `description` and import metadata | Preserve verbatim normalized text for audit and reparsing. |
| Hashtags | category/tag suggestions | Never create categories automatically during the first import. |
| Photo links | `photos` | Preserve order; validate paths, existence, size, MIME type, and SHA-256 before copying. |
| Video links | import metadata | Preserve and review because the current product model is photo-only. |
| Reply target | update candidate | Require manual review before linking to an existing product. |
| Identical timestamp media cluster | inferred album | Mark as inferred; replace with authoritative group data if a JSON export is supplied. |

## Ambiguous patterns

- HTML omits numeric Channel and media-group IDs.
- Several posts contain a price but no reliable product title.
- Tiered quantity prices and option-dependent prices share the same caption style.
- Repeated captions can represent reposts, updates, or distinct products with new media.
- Some products are marked unavailable but remain valid migration records.
- A few media-only posts cannot be linked confidently without inspecting neighboring posts.
- Hashtags mix product style, event type, price segment, and cultural classification; they are not a clean category taxonomy.
- The current website has no hidden/draft state, so imported products must not be inserted until that state is added.

## Safe implementation plan

1. Generate JSON, CSV, and Markdown dry-run reports from the untouched export.
2. Review missing titles, multiple prices, media-only posts, replies, inferred albums, and repeated captions.
3. Add a product publication state and dedicated import/synchronization tables through a reviewed migration.
4. Back up MySQL and `server/uploads` before applying the migration.
5. Import approved records as hidden review drafts; do not publish them externally.
6. Configure an official Telegram bot and resolve the Channel numeric ID with `getChat`.
7. Perform one reversible edit/restore test on a harmless legacy post selected from the report.
8. Use a database-backed outbox and cron-compatible worker for cPanel.
9. Default unpublish/delete behavior to preserving the Telegram post and marking it unavailable.
10. Default WhatsApp to an assisted admin publishing queue. Browser automation remains disabled.

## Initial files

- `server/src/telegram-import/html-parser.mjs`
- `server/src/telegram-import/classifier.mjs`
- `server/src/telegram-import/report.mjs`
- `server/src/telegram-import/cli.mjs`
- `server/test/telegram-import.test.mjs`
- `docs/telegram-migration-plan.md`
- `.gitignore`
- `server/package.json`
- `server/package-lock.json`
