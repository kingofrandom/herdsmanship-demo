# Herdsmanship PWA — Cloud Sync Setup

One-time setup. Takes about 10 minutes. After this, scores from the
PWA on every judge's phone sync into a single Google Sheet that lives
in **your** Google Drive.

## What you'll end up with

- A Google Sheet in your Drive named "Herdsmanship 2026 (Woodbury)"
  with tabs: Clubs, Barns, Stalls, Barn Layout, Judges, Rubric, Species, Settings, Scores, Schedule.
- A web app URL (long, ugly string) — paste it into the PWA's Setup
  screen on each judge's phone.
- Edits to Clubs / Barns / Stalls / Barn Layout / Judges / Rubric / Species you make in the sheet show up in
  the PWA the next time a judge opens it.
- Scores entered in the PWA are upserted one record at a time into the Scores tab within seconds
  (or get queued offline and sync when signal returns). Protected dataset/revision metadata keeps
  queued operations tied to the correct Sheet and prevents stale phones from restoring cleared data.

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
6. Go back to the sheet — you should now see the 10 tabs filled with
   the Woodbury clubs, barns, stalls, barn layout, rubric, etc.
7. Reload the Sheet once. A **Herdsmanship Admin** menu appears for owner/editor-only
   shared-score resets. The public Web App endpoint cannot perform this destructive action.

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
5. Tap **Save URL** — it auto-pulls the current configuration, shared scores,
   schedule, protected dataset identity, and score generation. The badge should change
   to **✓ Synced** and Last sync should show the current time.
6. Repeat step 1–5 on every judge's phone. They all paste the same URL.

## Step 5 — Hand off to Jamie

What Jamie controls from the sheet:

- **Clubs tab** — fix the leader names that came in truncated from
  the photo. Add a new club row if needed. Comma-separated species
  per club determines which species rows show up under each club.
- **Barns tab** — add/edit fair buildings or barn areas. Each row has a
  stable `Barn ID`, display `Name`, species served, area/building, sort
  order, and notes.
- **Stalls tab** — maintain the available stall/pen inventory for each
  barn. Each row belongs to a `Barn ID` and has a `Stall ID`, species,
  label, status, and notes.
- **Barn Layout tab** — assign each club/species to a `Barn ID`, set
  `Pen Count`, `Stalls Used`, and `Location Notes`. These fields drive
  the pen-count badge and the barn layout map shown below the species picker.
- **Judges tab** — add/remove judges; set Active to N to hide one
  without deleting their row.
- **Rubric tab** — change weights or hints. Total should stay 100.
- **Species tab** — add or rename animal categories. `ID` is the stable lowercase key used by
  Clubs, Barns, Stalls, Barn Layout, Scores, and Schedule; `Name` and `Emoji` control the app label.
  For example: `llama` / `Llama and Alpaca` / `🦙`.
- **Settings tab** — fair name, year, superintendent details, and operational timestamps.
  Dataset identity and score generation are protected Script Properties, not editable Sheet cells.

What the PWA controls (no sheet edits):

- Per-shift "I'm Judge X, Pass Y" picker.
- Daily inspection schedule. Each changed pass/species slot is written independently,
  so two devices editing different slots do not replace one another's work.

## Adding barns, stalls, and club assignments

Barn and stall management is intentionally spreadsheet-driven:

- **Barns** is the master list of buildings/areas.
- **Stalls** is the available stall/pen inventory inside each barn.
- **Barn Layout** assigns a club/species to a barn and a stall/pen range.

To add a new barn or building area:

1. In the **Barns** tab, add one row:
   - `Barn ID` — short lowercase key with no spaces, e.g. `beef-north`
   - `Name` — display name, e.g. `North Beef Barn`
   - `Species (comma sep)` — species IDs served by this barn, e.g. `beef,dairy`
   - `Area / Building` — broad fairgrounds area, e.g. `North barn`
   - `Sort Order` — number used for display order
   - `Notes` — optional

To add/manage stall or pen inventory:

1. In the **Stalls** tab, add one row per stall/pen/cage:
   - `Barn ID` — must exactly match a Barns tab `Barn ID`
   - `Stall ID` — stable key, e.g. `A10`
   - `Species` — species ID, e.g. `beef`, `swine`, `sheep`
   - `Label` — human label shown to staff, usually same as `Stall ID`
   - `Status` — optional status such as `open`, `reserved`, or `closed`
   - `Notes` — optional aisle/wall notes

To add a new club/addition and assign pens:

1. In the **Clubs** tab, add one row:
   - `ID` — short lowercase key with no spaces, e.g. `newclub`
   - `Name` — display name shown in the app
   - `Leaders` — optional leader/contact text
   - `Species (comma sep)` — species IDs this club should appear under,
     e.g. `beef,swine,sheep`
   - `Notes` — optional
2. In the **Barn Layout** tab, add one row for each species the club has:
   - `Club ID` — must exactly match the Clubs tab `ID`
   - `Species` — must match the species ID, e.g. `beef`, `swine`, `sheep`
   - `Barn ID` — must exactly match the Barns tab `Barn ID`
   - `Pen Count` — number shown on the app's pen badge
   - `Stalls Used` — stall/pen range assigned to this club, e.g. `A10–A12`
   - `Location Notes` — optional aisle/wall description
3. On each judge phone, open the PWA and tap **Setup → Sync now**
   or force-close/reopen the app. The new barn, stall inventory, club,
   and pen assignment should appear under the selected species.

Example Barn Layout rows:

| Club ID | Species | Barn ID | Pen Count | Stalls Used | Location Notes |
|---|---:|---|---:|---|---|
| newclub | beef | beef-north | 3 | A10–A12 | West aisle |
| newclub | swine | swine | 2 | P27–P28 | East row |

## Troubleshooting

- **"⚠ Could not reach sheet"** when tapping Sync now → the URL is
  wrong, the deployment was deleted, or your phone is offline.
  Check the URL by pasting it into a browser — you should see
  `{"ok":true,"config":...}`.
- **Edits to the sheet not showing up in the PWA** → Pull happens on
  app launch and on tap of "Sync now". Have the judge force-close
  and reopen the app, or tap Sync now.
- **Multiple judges scoring the same club/species/pass** → the backend detects a revision
  conflict instead of silently overwriting the other judge. Tap **Needs review** in Setup
  to see/copy details; unrelated records continue syncing normally.
- **Want a fresh start** → first make sure the latest `Code.gs` is deployed. In the
  Google Sheet use **Herdsmanship Admin → Clear all scores…**. The owner-only action
  clears Scores and advances the protected generation; stale/offline score changes move
  to **Needs review** when devices reconnect. Do not manually clear the Scores tab.
- **Want sample/demo data** → use **Setup → Restore sample data on this device**.
  A visible Sample mode banner remains across reloads. Sample scores and schedule edits
  never enter the sync queue; tap **Return to live data** before syncing.
- **Needs review is nonzero** → tap the row to see why an operation was quarantined
  (wrong Sheet, stale reset generation, record conflict, or invalid data) and copy the
  preserved recovery details. After reviewing/copying, use **Discard reviewed local changes**
  to clear the recovery list before changing the backend URL or re-entering the score.
- **“⚠ Sync issue” after updating the PWA** → deploy the latest `Code.gs` as a new
  Apps Script version. The updated client intentionally refuses the old whole-sheet
  snapshot protocol.

## Re-deploying after editing Code.gs

If you change the Apps Script: **Deploy → Manage deployments →
pencil icon → Version: New version → Deploy**. The URL stays the
same; no need to re-paste in the PWA.
