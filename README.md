# Nord Home Sales Desk

Walk-in visit log, dashboard with charts, daily report for management, and the quotation maker, in one app with a proper sign-in.
Data is saved in Supabase, so everyone on the team sees the same visits and quotations.

## Set up (about 15 minutes)

### 1. Supabase
1. Create a project at supabase.com (free plan is enough).
2. **SQL Editor > New query**: paste the contents of `supabase.sql` and click **Run**. This creates the `visits` and `quotations` tables.
3. **Project Settings > API**: copy the **Project URL** and the **service_role** key (keep it secret).
4. **Authentication > Users > Add user > Create new user**: add an email and password for each person, and tick **Auto Confirm User**.
5. **Authentication > Sign In / Providers**: turn **off** "Allow new users to sign up", so only people you add can have accounts.

### 2. Vercel
1. Put this folder in a GitHub repo and import it in Vercel (**Add New > Project**). Leave all settings as they are.
2. Before deploying, open **Environment Variables** and add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service_role key
3. Click **Deploy**.

### 3. First use
Sign in, open **Visits** and click **Load existing visits** once. This imports the 176 visits from your Excel sheet.

## View-only accounts (for management)
Everyone can add and edit by default. To make an account read-only (it can see the dashboard, reports, visits and quotations, and print or export them, but cannot change anything), run this in the Supabase SQL Editor, using that person's email:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"viewer"}'
where email = 'manager@example.com';
```
To make them an editor again, run the same with `'{"role":"editor"}'`. The person must sign out and in again.

## Where things are
- `public/index.html`, `style.css`, `app.js`, `charts.js`, `quote.js` - the app (login, dashboard, report, visits, quotation maker).
- `public/logo.png` - the Nord Home logo, used on the login screen, sidebar, quotation and Excel export.
- `public/seed.json` - your existing visits (used by "Load existing visits"; you can delete it afterwards).
- `api/auth.js` - sign in and session refresh. `api/visits.js`, `api/quotations.js` - save and load data.
- `supabase.sql` - creates the tables.

## Notes
- The service_role key lives only in Vercel's environment variables. It is never sent to the browser, and the tables are locked so nobody can read them without signing in through the app.
- Forgot password: reset it in Supabase under Authentication > Users.
- Backups: "Download Excel (CSV)" on the Visits page exports every visit. Supabase can also export both tables.
- Standard terms and conditions for quotations are in `public/quote.js` (`var TERMS`).
