# Database

The schema for noalanPRO Ops lives in [`migrations/0001_init.sql`](migrations/0001_init.sql).

## Apply it (one time)

**Option A — paste into the dashboard (no extra tooling):**

1. Open the Supabase dashboard → your project → **SQL Editor** → **New query**.
2. Copy the entire contents of `migrations/0001_init.sql` and paste it in.
3. Click **Run**. You should see "Success. No rows returned."

**Option B — Supabase CLI** (if installed and linked):

```bash
supabase db push
```

## Create your login user

The app uses email + password auth. Create your account once:

Dashboard → **Authentication → Users → Add user** → enter your email + a password
→ enable "Auto Confirm User".

Then sign in at the app with those credentials.

## Notes

- Every table is **owner-scoped** with Row Level Security — a signed-in user
  only ever sees rows where `owner_id = auth.uid()`. `owner_id` defaults to the
  caller automatically, so the app never has to set it.
- `invoice_line_items.amount` and the `invoice_summary` view are computed in the
  database, so totals can never drift from the underlying rows.
- Field names mirror QuickBooks import columns to make a future export step easy.
