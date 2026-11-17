# Walk-in Visit Log

Enter visits, get a daily / weekly / monthly report to send to management. Data is saved in Supabase, so it stays after you close the page.

## Set up (about 10 minutes)

**1. Supabase**
- Create a project at supabase.com (free plan is enough).
- Open **SQL Editor > New query**, paste the contents of `supabase.sql`, click **Run**.
- Open **Project Settings > API** and copy two things: the **Project URL** and the **service_role** key.
  The service_role key is secret. Never put it in the page or share it.

**2. Vercel**
- Put this folder in a GitHub repo and import it in Vercel (**Add New > Project**). Leave settings as they are.
- Before deploying, open **Environment Variables** and add:
  - `SUPABASE_URL` = your Project URL
  - `SUPABASE_SERVICE_ROLE_KEY` = your service_role key
  - `APP_PASSWORD` = the password your team will use
- Click **Deploy**.

**3. First use**
- Open the site, sign in, click **Load existing visits** once to import the 176 visits from your Excel sheet.

## Files

- `public/index.html` - the whole app (report, add visit, insights, all visits).
- `public/seed.json` - your existing visits from the Excel sheet.
- `api/visits.js` - saves and loads visits in Supabase.
- `supabase.sql` - creates the table.

## Notes

- If `APP_PASSWORD` is not set, anyone with the link can read and write visits. Always set it.
- "Download Excel (CSV)" on the All visits tab exports everything for backup. Supabase also lets you export the table from its dashboard.
- Remove `public/seed.json` after the first import if you like.
