# Browserless managed browsers (Playwright)

One Playwright workflow (the example spec in `tests/browserless/`) runs on Browserless
managed browsers. The rest of the suite still runs locally through `playwright.config.ts`.

## Setup

1. Create a free Browserless account and copy the API token from
   <https://browserless.io/account/>.
2. Export the token for your shell, or put it in the git-ignored `.env.local` at the repo
   root (the npm script loads that file with Node's `--env-file-if-exists`):

   ```
   BROWSERLESS_TOKEN=your-token
   ```

   `.env.example` declares the variable empty; never commit a real token.

3. Run the example:

   ```bash
   npm run test:browserless
   ```

## How it connects

`playwright.browserless.config.ts` builds
`wss://production-sfo.browserless.io/chromium/playwright?token=...` from `BROWSERLESS_TOKEN`
and hands it to Playwright through `use.connectOptions.wsEndpoint`, so the test uses a
managed browser instead of a local binary. Override `BROWSERLESS_ENDPOINT` to target another
region.

Browserless docs: <https://docs.browserless.io/baas/quick-start>
