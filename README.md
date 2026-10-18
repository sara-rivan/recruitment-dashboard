# Network referral command centre (GitHub Pages)

A GitHub Action reads Airtable every hour, works out the figures and publishes them with the page. The TV just opens the link.

## What is in here
- `index.html` – the dashboard page (no Claude, no sign-in).
- `scripts/build_data.js` – reads Airtable with a read-only token and writes `data.json`.
- `.github/workflows/update.yml` – runs the script every hour and publishes the site.

## One-off setup
1. **Create a repository** on GitHub, e.g. `rivan-dashboard`. Free GitHub Pages needs a **public** repository.
2. **Add these files**, keeping the folders exactly as they are (`scripts/…` and `.github/workflows/…`).
   Hidden folders such as `.github` sometimes don't upload by drag-and-drop on a Mac. If it is missing, use *Add file → Create new file*, type `.github/workflows/update.yml` as the name and paste the file's contents.
3. **Create an Airtable token:** airtable.com/create/tokens → *Create token*.
   - Scope: `data.records:read` only.
   - Access: the **Rivan Ops** base only.
4. **Save the token in GitHub:** repository *Settings → Secrets and variables → Actions → New repository secret*.
   - Name: `AIRTABLE_TOKEN`
   - Value: the token.
5. **Turn on Pages:** *Settings → Pages → Build and deployment → Source: GitHub Actions*.
6. **Run it once:** *Actions → Update dashboard → Run workflow*. It takes a couple of minutes.
7. **Open** `https://<your-username>.github.io/<repository-name>/` on the TV.

After that it refreshes itself every hour, and the page checks for new data every 5 minutes.

## What is published (it is a public web page)
Only totals, role names and team member names. No candidate names, emails or LinkedIn links are written to the page.
Anyone with the link can see it. Don't share the link outside the company.

## Things to know
- **Timing:** GitHub can run hourly jobs 5–15 minutes late. The footer shows when the data was last built and turns red if it is more than 3 hours old.
- **Schedules can switch off:** GitHub may pause scheduled runs in a repository with no activity for 60 days. If the footer goes red, open *Actions* and re-enable the workflow, or run it by hand.
- **Field names:** the Airtable filters use the field names `Where did you hear about this role?`, `Status` (Applications Funnel) and `[LIVE FIELD] Archetype (Yes/No)` (Archetype Selection). If someone renames one, edit the matching line in `scripts/build_data.js`.
- **Errors:** open the failed run in *Actions*. `401`/`403` = token or base access; `422` = a field name in the filters has changed. If a run fails, the old page and data stay online.

## Definitions (same as the Claude dashboard)
- **Archetypes per role:** Archetype Selection rows with Archetype = Yes. % engaged = those people found in the Referral Funnel at an engaged status (matched by Gem ID).
- **Engaged:** unique people in the Referral Funnel at `2. Engagement` or `No.2 - Not interested in further discussion`.
- **Net-new hires:** applications at `10. Contract Signed` who are also in the Referral Funnel (matched by email or LinkedIn).
- **Net-new engagements by week:** first week each person reached `2. Engagement` (Last status review), plus Referral applications whose "Please specify" names a team member (Date Applied). From w/c 5 Oct 2026.
- **Referral leaderboard:** Score in Recruitment - Internal Referrals Leaderboard.
- **Actions to do:** Referral Funnel records at `0. Pending Outreach` for more than 2 days or `1. Outreach Message Sent` for more than 7 days, by Last status review.
