# Telegram product synchronization

- Prefer editing a product's existing Telegram post in place.
- When a replacement post is necessary, verify its content, photos, and saved product linkage before removing the superseded post and every superseded album message.
- Remove superseded posts completely. Do not leave duplicate product posts or redirect-only posts unless the user explicitly requests that exception.
- Check whether the old messages can be deleted before publishing replacements. If deletion is blocked by Telegram's bot limits, arrange cleanup through a signed-in channel-admin session or explain the blocker before republishing. Do not silently leave duplicates.
- Preserve the original and replacement message IDs until cleanup is verified. Delete only confirmed superseded messages; keep current replacement posts intact.
- Report synchronization and old-post cleanup separately. Do not claim cleanup is complete until the old messages are confirmed absent.
- An API response saying a message cannot be deleted is a failure, not proof that it was already deleted.
