# Deploying the AM Cost Calculator as a shared website

This turns the desktop app into an internal website on **Vercel** (hosting) with **Supabase** (database + sign-in). One-time setup takes about 20 minutes.

## How it fits together

```
Browser ──► Vercel ── /api/* ──► FastAPI (backend/, Python function) ──► Supabase Postgres
   │           └──── everything else ──► React app (frontend/, static)
   └── sign-in ──► Supabase Auth
```

- **STL files never leave the user's computer.** Geometry (volume, height, projected area, overhangs, support estimate) is computed in the browser, so there is no upload size limit — Vercel functions only accept 4.5 MB per request.
- **All data goes through the backend**, which checks sign-in, admin rights and project ownership. The Supabase tables are locked away from Supabase's public REST API (Row Level Security on, no policies).
- **Access model:** colleagues are added by an admin (no public sign-up). Everyone can run analyses and sees all saved projects; only a project's creator or an admin can delete it. Only admins can add or change machines and materials.
- The Anthropic API key lives only on the server, as an environment variable.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick a region close to your users and remember it — the Vercel functions should run in the same region (step 3).
2. **SQL Editor → New query**: paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Leave the Email provider enabled.
4. **Authentication → Users → Add user → Create new user**: add yourself with a password and tick **Auto Confirm User**.
5. Make yourself an admin — **SQL Editor**:
   ```sql
   update public.profiles set is_admin = true where email = 'you@tii.ae';
   ```
   (Or open **Table Editor → profiles** and tick `is_admin`.)
6. Collect three values:
   - **Project URL** and **publishable key** — **Project Settings → API Keys** (`https://<ref>.supabase.co`, `sb_publishable_…`).
   - **Database URL** — **Connect** (top bar) → **Transaction pooler** (port 6543). Replace `[YOUR-PASSWORD]` with your database password.

## 2. Copy your existing data (once)

To bring over your current machines, materials and saved projects from `backend/metal_am_cost.db`, write them to a SQL file and run it in the Supabase SQL Editor. This goes over normal HTTPS, so it works on office networks that block database ports (5432/6543):

```bat
cd backend
venv\Scripts\python.exe migrate_to_supabase.py --sql-out supabase_import.sql --owner-email you@tii.ae
```

Then open `backend\supabase_import.sql`, copy everything, paste it into **SQL Editor → New query** and click **Run**. The last result shows the row counts. The file is git-ignored because it contains your project data; delete it afterwards.

`--owner-email` marks the imported projects as yours (that user must already exist, step 1.4). The import refuses to run if the Supabase tables already contain data.

On a network that allows database connections you can copy directly instead, with `--database-url "<Database URL from step 1.6>"` in place of `--sql-out …`.

## 3. Vercel

1. Push the code to GitHub (merge the `web-deployment` branch into `main`).
2. In Vercel: **Add New → Project** → import the repository. Keep the **Root Directory** as the repository root — [`vercel.json`](vercel.json) defines the two parts (`frontend/` and `backend/`).
3. **Environment Variables** (apply to Production and Preview):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `DATABASE_URL` | Transaction pooler URL (with password) |
   | `ANTHROPIC_API_KEY` | optional — enables AI insights |

4. **Settings → Functions → Function Region**: choose the region matching your Supabase project.
5. **Deploy**, open the URL and sign in.

If you change environment variables later, redeploy for them to take effect.

> `vercel.json` uses Vercel **Services** (currently beta) to host the React app and the Python API in one project. If that ever gives trouble, deploy them as two projects instead — one with root `frontend/`, one with root `backend/` — and give the frontend project a rewrite from `/api/(.*)` to `https://<backend-project>.vercel.app/api/$1`.

## 4. Adding colleagues

- **Add:** Supabase → **Authentication → Users → Add user** (tick *Auto Confirm User*) and share the password with them. They can change it under **Settings** in the app.
- **Make admin:** tick `is_admin` for them in **Table Editor → profiles**.
- **Reset a password / remove access:** from the same Users page. Removing a user keeps their saved projects.

Password-reset emails are not set up: Supabase's built-in email only reaches members of your Supabase team (2 emails/hour). Admins reset passwords from the dashboard instead, or configure a custom SMTP sender under **Authentication → Emails** later.

## Local development

- **Desktop mode is unchanged:** `LaunchAMCostCalculator.bat` still runs the app locally on the SQLite file, with no sign-in. After pulling these changes, run `InstallMissingPackages.bat` once to install the new packages (`psycopg`, `PyJWT`).
- **Locally against Supabase:** copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`, fill them in, then start the backend and frontend as usual.

## Good to know

- **Plans:** Vercel's free Hobby plan is for personal, non-commercial use, so an internal company tool should run on **Vercel Pro**. Free Supabase projects pause after about a week without activity; **Supabase Pro** avoids that and adds daily backups.
- **Preview deployments** (from branches/PRs) use the same database as production.
- **Very large meshes** (over ~4 million triangles, ≈200 MB binary STL) are fully analysed, but the watertight check and vertex count are skipped to save browser memory.
- Check with IT that storing cost data on Vercel/Supabase is acceptable. Part geometry stays on users' machines; only derived numbers and a small 3D-view image (for the PDF report) are saved with projects.
