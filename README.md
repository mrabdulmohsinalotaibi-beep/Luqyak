# لُقياك | Luqyak

This repository holds the source for the production **luqyak** Cloudflare Worker deployed at https://luqyak.athat.app.

## Current deployment

The source was synchronized from Cloudflare Worker version **210** on 2026-11-13.

## Safe deployment

- Worker entry: `worker.js`
- Worker config: `wrangler.jsonc`
- Run `npm install` then `npm run check`.
- `npm run deploy` deploys to Cloudflare **only with an authorized Cloudflare account/token**.
- Secrets (`RESEND_API_KEY`, `PUSH_VAPID_PRIVATE`, `PUSH_VAPID_PUBLIC`) stay in Cloudflare and are **not committed**.
- D1 `DB`, R2 `PHOTOS`, and Worker service `LIVE_CHANNEL` use existing resources; no data migrations are included.
- Production custom domain remains configured in the Cloudflare dashboard, not in this repository.
- Scheduled cleanup runs on `*/30 * * * *`.

Review and test before enabling any automatic deployments from GitHub.
اختبار النشر التلقائي لمشروع لقياك
