# Funds Ledger

A checkbook-style ledger for one user, split into a **restricted** and an **unrestricted** bucket. Single static page (no build step) hosted on GitHub Pages; data lives in a Google Sheet behind a Google Apps Script web app. Balances are always derived, never stored.

```
phone/browser ──HTTPS──► GitHub Pages (index.html, styles.css, manifest.json)
      │
      └──POST JSON──► Apps Script /exec ──► Google Sheet "Ledger"
                        (checks passphrase hash from Script Properties)
```

No secrets live in this repo. The Apps Script URL in `index.html` is public by nature; the passphrase exists only as a SHA-256 hash in Script Properties and on unlocked devices.

## One-time backend setup

1. **Create the Google Sheet.** Rename the first tab to `Ledger`. Add this header row:

   ```
   id | bucket | date | type | payee | amount | serviceMonth | cleared | note | active | updatedAt
   ```

   Set the `date` and `serviceMonth` columns to **Plain text** (Format → Number → Plain text) *before* any data goes in.

2. **Install the backend.** Extensions → Apps Script → delete the stub → paste `apps-script/Code.gs`.

3. **Set the passphrase.** Project Settings (gear) → Script Properties → add `PASSPHRASE_HASH` = the SHA-256 hex of the passphrase.

   > The app matches case- and whitespace-insensitively: it hashes the **trimmed, lowercased** phrase. Compute the hash of the lowercase form, e.g. `echo -n 'correct horse battery' | sha256sum` (no trailing newline, no leading/trailing spaces, all lowercase).

4. **Deploy.** Deploy → New deployment → type **Web app** → Execute as **Me**, Who has access: **Anyone** → Deploy. Copy the `/exec` URL into `index.html` as `API_URL`, commit, and push.

5. **Share the sheet** (edit access) with whoever provides oversight.

**Redeploying after any Code.gs change:** Deploy → Manage deployments → pencil → Version: **New version** → Deploy. Saving the script alone does not change the live URL's behavior.

## Frontend notes

- `styles.css` is the Broadsheet design-system stylesheet from the design handoff, shipped unchanged. All colors/spacing come from its tokens.
- The page renders instantly from a `localStorage` mirror (`assistance-ledger-v1`), then reconciles with the sheet. Writes are optimistic: the row appears immediately marked "Saving…", and a failed write shows "Didn't save — tap to retry" instead of silently dropping.
- The API call uses `Content-Type: text/plain` deliberately — `application/json` triggers a CORS preflight that Apps Script cannot answer. Do not "fix" this.
- Deletes are soft (`active = FALSE` in the sheet). Sheets version history is the backup.

## Device setup (per device, in person)

1. Open the GitHub Pages URL in Safari (iPhone) or Chrome (Android).
2. Enter the passphrase (leave "Remember me" checked).
3. Share → **Add to Home Screen** → Add.
4. Open from the icon once to confirm it launches full-screen and the ledger loads.
