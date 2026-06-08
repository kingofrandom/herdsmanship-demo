# Herdsmanship PWA — Cloud Sync Setup

One-time setup. Takes about 10 minutes. After this, scores from the
PWA on every judge's phone sync into a single Google Sheet that lives
in **your** Google Drive.

## What you'll end up with

- A Google Sheet in your Drive named "Herdsmanship 2026 (Woodbury)"
  with tabs: Clubs, Barn Layout, Judges, Rubric, Species, Settings, Scores, Schedule.
- A web app URL (long, ugly string) — paste it into the PWA's Setup
  screen on each judge's phone.
- Edits to Clubs / Barn Layout / Judges / Rubric you make in the sheet show up in
  the PWA the next time a judge opens it.
- Scores entered in the PWA appear in the Scores tab within seconds
  (or get queued offline and sync on the next save when signal returns).

## Step 1 — Create the sheet

1. Go to https://sheets.google.com and click **Blank**.
2. Rename it to: `Herdsmanship 2026 (Woodbury)`.
3. Move it into whatever Drive folder you want (optional).

## Step 2 — Paste in the Apps Script

1. In the sheet, click **Extensions → Apps Script**.
2. Delete the placeholder `function myFunction() { ... }`.
3. Open the file `Code.gs` from this project (sits next to `index.html`),
   select everything, copy, paste it into the Apps Script editor.
4. Click the disk icon to save (Ctrl/Cmd+S). Name the project
   `Herdsmanship Backend` if it asks.
5. In the function dropdown at the top, pick **setupTabs**, then click
   **Run**. The first run will pop up an authorization screen — click
   **Review permissions** → pick your Google account → **Advanced** →
   **Go to Herdsmanship Backend (unsafe)** → **Allow**. (This is the
   normal Google warning for any script you wrote yourself.)
6. Go back to the sheet — you should now see the 8 tabs filled with
   the Woodbury clubs, barn layout, rubric, etc.

## Step 3 — Deploy as a Web App

1. Back in Apps Script: **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → **Web app**.
3. Fill in:
   - Description: `Herdsmanship PWA backend`
   - Execute as: **Me (your email)**
   - Who has access: **Anyone**
4. Click **Deploy**. Authorize again if prompted.
5. Copy the **Web app URL** (looks like
   `https://script.google.com/macros/s/AKfyc...../exec`).

> The "Anyone" setting only means anyone with this exact URL can
> POST scores into your sheet. It does not list it publicly. Treat
> the URL like a password — anyone with it can write to your sheet.
> If it ever leaks, just go back to Deploy → Manage deployments and
> create a new deployment (the URL changes).

## Step 4 — Paste the URL into the PWA

1. Open the PWA: https://kingofrandom.github.io/herdsmanship-demo/
2. Tap **Setup** (bottom right).
3. Scroll to **Cloud sync · Google Sheet**.
4. Paste the URL into the field.
5. Tap **Save URL** — it'll auto-pull the config from the sheet and
   push the current local scores. The badge should change to
   **✓ Synced** and Last sync should show the current time.
6. Repeat step 1–5 on every judge's phone. They all paste the same URL.

## Step 5 — Hand off to Jamie

What Jamie controls from the sheet:

- **Clubs tab** — fix the leader names that came in truncated from
  the photo. Add a new club row if needed. Comma-separated species
  per club determines which species rows show up under each club.
- **Barn Layout tab** — set each club/species `Pen Count`, `Stalls Used`,
  and `Location Notes`. These fields drive the pen-count badge and the
  barn layout map shown below the species picker.
- **Judges tab** — add/remove judges; set Active to N to hide one
  without deleting their row.
- **Rubric tab** — change weights or hints. Total should stay 100.
- **Settings tab** — fair name, year, etc.

What the PWA controls (no sheet edits):

- Per-shift "I'm Judge X, Pass Y" picker.
- Daily inspection schedule (Schedule tab is a mirror of the PWA's
  schedule view).

## Troubleshooting

- **"⚠ Could not reach sheet"** when tapping Sync now → the URL is
  wrong, the deployment was deleted, or your phone is offline.
  Check the URL by pasting it into a browser — you should see
  `{"ok":true,"config":...}`.
- **Edits to the sheet not showing up in the PWA** → Pull happens on
  app launch and on tap of "Sync now". Have the judge force-close
  and reopen the app, or tap Sync now.
- **Multiple judges scoring the same club/species/pass** → the
  current backend is last-write-wins. If you need per-judge
  attribution we can add it; tell Jason.
- **Want a fresh start mid-fair** → in the sheet, clear the Scores
  tab (keep the header row). Then in the PWA tap Setup → Reset demo
  data on every phone. (Or skip the PWA reset and just let it
  overwrite — but every phone's local copy will keep its scores.)

## Re-deploying after editing Code.gs

If you change the Apps Script: **Deploy → Manage deployments →
pencil icon → Version: New version → Deploy**. The URL stays the
same; no need to re-paste in the PWA.
