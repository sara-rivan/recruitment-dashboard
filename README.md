# TV recruitment dashboard

A static page (`index.html`) that reads `data.json`. A GitHub Action refreshes `data.json`
from Airtable every 3 hours. GitHub Pages serves the page.

## One-time setup

1. **Create a GitHub repo** (e.g. `tv-dashboard`) and upload everything in this folder,
   including the hidden `.github` folder.
2. **Create an Airtable token**: https://airtable.com/create/tokens
   - Scope: `data.records:read`
   - Access: your "Rivan Ops" base only
3. **Add two repo secrets** (Settings > Secrets and variables > Actions > New repository secret):
   - `AIRTABLE_TOKEN` = the token
   - `AIRTABLE_BASE_ID` = `appuiyuClsVHmWj1h`
4. **Turn on Pages**: Settings > Pages > Source: "Deploy from a branch" > Branch `main`, folder `/ (root)` > Save.
5. **Run the Action once**: Actions tab > "Update dashboard data" > Run workflow.
   After about a minute `data.json` is replaced with real data and the red SAMPLE banner disappears.
6. **Open on the TV**: `https://<your-username>.github.io/<repo-name>/`

## Options (add to the URL)

`?rows=10&secs=30` shows 10 roles per screen and flips every 30 seconds (defaults: 12 and 20).

## Changing what is shown

- Columns and colours: `index.html` (the `COLS` list).
- Airtable field names: `scripts/fetch-airtable.mjs` (the `FIELD_MAP` list).
- Which roles: `FILTER` in the same script (currently `{Planned}='Hiring'`).
- Refresh frequency: the `cron` line in `.github/workflows/update-data.yml`.

## Privacy

GitHub Pages sites are public to anyone with the link, and `data.json` is stored in the repo.
It contains role-level numbers and hiring-manager names, but no candidate names.
