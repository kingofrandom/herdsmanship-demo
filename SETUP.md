# Herdsmanship PWA — Cloud Sync Setup

One-time setup. Takes about 10 minutes. After this, scores from the
PWA on every judge's phone sync into a single Google Sheet that lives
in **your** Google Drive.

## What you'll end up with

- A Google Sheet in your Drive named "Herdsmanship 2026 (Woodbury)"
  with tabs: Clubs, Barns, Stalls, Barn Layout, Judges, Rubric, Species, Settings, Scores, Schedule.
- A web app URL used by the production PWA. The deployed endpoint is embedded in
  the app, so judge phones connect automatically.
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
4. Click **+ → HTML**, name it `AdminDialog`, then copy the contents of
   `AdminDialog.html` from this project into that file.
5. Click the disk icon to save (Ctrl/Cmd+S). Name the project
   `Herdsmanship Backend` if it asks.
6. In the function dropdown at the top, pick **setupTabs**, then click
   **Run**. The first run will pop up an authorization screen — click
   **Review permissions** → pick your Google account → **Advanced** →
   **Go to Herdsmanship Backend (unsafe)** → **Allow**. (This is the
   normal Google warning for any script you wrote yourself.)
7. Go back to the sheet — you should now see the 10 tabs filled with
   the Woodbury clubs, barns, stalls, barn layout, rubric, etc.
8. Reload the Sheet once. A **Herdsmanship Admin** menu appears. Global Setup-lock
   controls are shown only to the spreadsheet owner; shared-score reset remains a Sheet action.

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

> The "Anyone" setting is required for judge phones that are not signed into the
> owner's Google account. The production endpoint is embedded in the PWA and is not
> treated as a secret; the backend validates dataset identity, score generation,
> revisions, operation IDs, judges, clubs, species, ratings, and notes before writing.

## Step 4 — Verify automatic phone sync

1. Open the PWA: https://kingofrandom.github.io/herdsmanship-demo/
2. Leave it open online for a few seconds. It automatically pulls the current
   configuration, shared scores, schedule, protected dataset identity, and score generation.
3. Tap **Setup** (bottom right), scroll to **Cloud sync · Google Sheet**, and confirm
   the badge shows **✓ Synced**, **Queued (unsynced)** is `0`, and **Needs review** is `0`.
4. Repeat on every judge's phone. No URL entry is required. The app also refreshes
   when opened, when connectivity returns, and when it returns to the foreground.

### Optional — protect Setup globally

The spreadsheet owner can protect Setup on every synced device at once:

1. Reload the Google Sheet so **Herdsmanship Admin** appears.
2. Choose **Herdsmanship Admin → Set/change global Setup password…**.
3. Enter and confirm a 10–64 character administrator password.
4. Refresh each judge phone once while online. Opening Setup now requires that password.

Only the spreadsheet owner can set, change, or turn off the lock. The readable password
is never stored; Apps Script keeps only a salted hash in protected Script Properties.
Phones receive only the shared enabled/revision state and verify access online. To remove
protection everywhere, use **Herdsmanship Admin → Turn off global Setup lock…**.

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
3. On each judge phone, reopen or return to the PWA. It syncs automatically;
   **Setup → Sync now** remains available as a manual refresh. The new barn, stall inventory, club,
   and pen assignment should appear under the selected species.

Example Barn Layout rows:

| Club ID | Species | Barn ID | Pen Count | Stalls Used | Location Notes |
|---|---:|---|---:|---|---|
| newclub | beef | beef-north | 3 | A10–A12 | West aisle |
| newclub | swine | swine | 2 | P27–P28 | East row |

## Troubleshooting

- **"⚠ Could not complete sync"** → the deployment may be unavailable or the phone
  may be offline. Check the production Apps Script URL in Setup by opening it in a browser;
  you should see
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
  to clear the recovery list before re-entering the score.
- **“⚠ Sync issue” after updating the PWA** → deploy the latest `Code.gs` as a new
  Apps Script version. The updated client intentionally refuses the old whole-sheet
  snapshot protocol.
- **Forgot the Setup password** → the readable password cannot be recovered. The spreadsheet
  owner can use **Herdsmanship Admin → Set/change global Setup password…** to replace it, or
  **Turn off global Setup lock…** to remove protection. Refresh phones while online afterward.

## Re-deploying after editing Code.gs

If you change the Apps Script: **Deploy → Manage deployments →
pencil icon → Version: New version → Deploy**. The URL stays the
same; no need to re-paste in the PWA.
