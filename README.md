# Workflow Management

A shared, authenticated workflow command center for Audit Expert, Yens and Santos, AIMA, and Shelly's Bistro.

The application supports two explicit modes:

- **Shared production mode** — Supabase Auth and PostgreSQL hold one persistent snapshot for all allowlisted users. A System Administrator connects Google once and refreshes the canonical Sheet and bounded Gmail evidence server-side.
- **Local reference mode** — the Git-ignored verified local snapshot remains available only on the current device. It contains the existing 17 staff records and 543 workplan rows and can be imported into shared mode by an administrator.

Sharing a ChatGPT or Codex task is not how operational data is distributed. In production, invite teammates from **Data & Connections** and share the deployed dashboard URL.

## What is implemented

- Supabase passwordless authentication and administrator bootstrap.
- PostgreSQL schema and row-level organization authorization.
- Administrator-only dashboard invitations with viewer, editor, and administrator roles.
- One administrator-owned Google OAuth connection with encrypted refresh-token storage.
- Exact authorized Google identity verification.
- Shared Google Sheets synchronization for `Staff Details and Task` and the four approved routine workbooks.
- Bounded Gmail synchronization for `in:anywhere otter -in:spam -in:trash`, including readable TXT, EML, and DOCX attachment extraction.
- Persistent refresh runs, safe connector status, counts, and audit events.
- Retention of the last successful snapshot after refresh failures.
- Administrator import of the verified Git-ignored local Sheet snapshot.
- Shared Staff Directory, Workplan, KPIs, and Gmail evidence register.
- Persistent editor task overrides for reviewed status, assignment wording, and notes, with original Sheet provenance retained.
- Privacy-safe file export that excludes addresses and message contents.

Google Sheets and Gmail remain read-only. Gmail evidence without an explicit organization mapping is visible only to a System Administrator until it is mapped.

## Accounts and values needed to go live

1. **Supabase project**
   - Project URL
   - Publishable key
   - Secret key
   - Run [`supabase/migrations/202608180001_shared_dashboard.sql`](supabase/migrations/202608180001_shared_dashboard.sql), followed by [`supabase/migrations/202608180002_routines_and_attachments.sql`](supabase/migrations/202608180002_routines_and_attachments.sql), in the Supabase SQL editor.

2. **Dashboard administrators**
   - `DASHBOARD_ADMIN_EMAILS` is a comma-separated allowlist.
   - The confirmed administrators are `richardc@yensbooks.com`, `richardc@shellysbistro.com`, `scrum@aimadvisors.ca`, and `catherine@aimadvisors.ca`.
   - Each address becomes a System Administrator after its first passwordless sign-in.

3. **Google Cloud OAuth web client**
   - Enable Google Sheets API, Gmail API, and Google Drive API.
   - OAuth client ID and client secret.
   - Add `https://YOUR_DEPLOYED_DOMAIN/api/google/callback` as an authorized redirect URI.
   - Add the administrator/connector address as an OAuth test user if the consent screen remains in testing.

4. **Authorized source account**
   - The product contract currently requires `catherine@yensbooks.com` for Gmail.
   - Share the canonical `Staff Details and Task` workbook with that same account if it does not already have access.
   - If a different mailbox is intended, change `GOOGLE_AUTHORIZED_EMAIL` and update `MASTER_PROMPT.md` in the same checkpoint.

5. **Connector encryption key**
   - Generate 32 random bytes and encode them as Base64.
   - Store the value only as `CONNECTOR_ENCRYPTION_KEY` in the deployment secret store. Never commit it.

6. **Hosting**
   - A Vercel project connected to this GitHub repository is the simplest deployment.
   - Set the variables from [`.env.example`](.env.example) in Vercel Production and Preview settings.
   - Set `APP_URL` and `GOOGLE_REDIRECT_URI` to the deployed HTTPS domain.
   - Set `CRON_SECRET` if the scheduled refresh in `vercel.json` is enabled.

## Production setup sequence

1. Create Supabase and apply the SQL migration.
2. Configure Supabase email authentication and the application Site URL.
3. Add all environment variables to the host.
4. Run the app locally with the shared-mode environment values, sign in with one of the `DASHBOARD_ADMIN_EMAILS`, and use **Import verified local snapshot**. This moves the existing 17 staff and 543 tasks from the Git-ignored local file into PostgreSQL without deploying or committing that file.
5. Deploy the application.
6. Sign in with any configured administrator address and open **Data & Connections**.
7. Select **Connect Google** and approve the read-only scopes with the exact authorized account.
8. Select **Refresh now** to replace the imported snapshot with a current live read, import the approved Daily/Weekly/Monthly routines, and ingest bounded Gmail/Otter evidence.
9. Invite teammates and give them explicit organization access.

## Local development

```bash
pnpm install
pnpm dev
```

Without environment variables, open `http://localhost:3000` to use local reference mode. Copy `.env.example` to `.env.local` and fill it in to exercise shared mode.

## Verification

```bash
pnpm typecheck
pnpm build
```

The local source file under `data/local/` and every `.env*` file are Git-ignored.
