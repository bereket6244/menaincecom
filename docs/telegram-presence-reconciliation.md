# Reconcile a deleted product post

Configure `TELEGRAM_SYNC_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_CHANNEL_USERNAME`, `TELEGRAM_API_ID`, and `TELEGRAM_API_HASH` on the server. The API ID and hash come from a Telegram application. The bot must be able to read the named channel. Keep these values in server environment variables, never in the browser.

An authenticated admin can call `POST /admin/products/:id/telegram/reconcile`. This is an explicit action; ordinary product saves do not automatically publish a replacement. The server reads every saved message ID through Telegram MTProto, checks again after claiming the product, and publishes only when at least one message is explicitly absent. If an album has surviving messages, it deletes those first and confirms that all old IDs are absent before publishing. A successful response reports `status: "republished"`, `cleanup: "confirmed_absent"`, old IDs, new IDs, and the saved product.

`present` means every old message remains. `unverified` means the read, channel identity, or cleanup could not be confirmed; no replacement is sent. `blocked` means an earlier cleanup or reconciliation needs attention. Telegram errors and timeouts never count as proof of deletion.

The reconciliation claim stays on the product if publishing may have happened but saving the new linkage failed. This deliberately blocks automatic retries: an admin must inspect the channel and product record, recover any new message IDs, and clear the claim only after resolving the linkage. The same care applies to any `replacement_unverified` result. Do not retry publishing blindly.

This check requires a username-addressable channel. It does not run for private channels without a username. The bot MTProto request uses the existing bot token; it does not require a signed-in human session. No live Telegram posts are used by the automated tests.
