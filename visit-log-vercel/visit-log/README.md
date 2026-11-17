# Walk-in Visit Log

Enter visits, get a daily / weekly / monthly report to send to management. Data is saved in Redis, so it stays after you close the page.

## Deploy on Vercel (about 5 minutes)

1. Put this folder in a GitHub repo (or run `vercel` from this folder with the Vercel CLI).
2. In Vercel: **Add New > Project**, pick the repo, leave all settings as they are, click **Deploy**.
3. In the project, open **Storage** (or the Marketplace), add **Upstash Redis** (free plan is enough) and connect it to the project.
   Vercel adds the database variables for you.
4. Open **Settings > Environment Variables** and add `APP_PASSWORD` with the password your team will use.
5. Go to **Deployments > Redeploy** so the new variables take effect.
6. Open your site, sign in, and click **Load existing visits** once to import the 176 visits from your Excel sheet.

## Files

- `public/index.html` - the whole app (report, add visit, insights, all visits).
- `public/seed.json` - your existing visits from the Excel sheet.
- `api/visits.js` - saves and loads visits in Redis.

## Notes

- If `APP_PASSWORD` is not set, anyone with the link can read and write visits. Always set it.
- "Download Excel (CSV)" on the All visits tab exports everything for backup.
- Delete `public/seed.json` after the first import if you like.
