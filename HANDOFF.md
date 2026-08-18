# Workflow Management Handoff

Checkpoint date: 2026-08-18 (America/Winnipeg)

## Repository state discovered

- The downloaded folder originally contained only `MASTER_PROMPT.md` and no `.git` metadata.
- Archive source metadata identified `https://github.com/catherine557/workflow-management`.
- Remote `main` and `codex/workflow-management-implementation` both pointed to commit `9b9e11013e3c42a1ad6ff8165276cb2615825fab`.
- That commit's complete tree contained only `MASTER_PROMPT.md`.
- No earlier `HANDOFF.md` or dashboard application existed in remote history.
- The local folder was safely reattached to `origin/main` without replacing the downloaded prompt.

## Implemented in this checkpoint

- Production shared-dashboard mode using Supabase Auth and PostgreSQL.
- Database migration with allowlisted profiles, organization grants, RLS policies, connector records, sync runs, staff/workplan snapshots, Gmail evidence, and audit events.
- Passwordless sign-in, first-administrator bootstrap, sign-out, and role-scoped team invitations.
- Administrator-only Google OAuth web flow with exact mailbox verification and AES-256-GCM encrypted refresh tokens.
- Live server-side synchronization for the canonical Sheet and bounded Gmail/Otter query, with last-successful snapshot retention on errors.
- Live read-only synchronization for the four approved routine workbooks, restricted to Daily, Weekly, and Monthly tabs, with section-heading exclusion and staff organization mapping.
- Readable Gmail attachment extraction for TXT, EML, and DOCX evidence, with bounded stored text and a short administrator evidence excerpt in the list UI.
- Administrator import path for the existing Git-ignored 17-staff/543-task local snapshot.
- Shared connection status, administrator Connect/Refresh/Invite controls, and a populated Gmail evidence register after sync.
- Share UX now directs teammates to the authenticated live deployment rather than implying a chat or file export contains the operational database.

- Next.js App Router foundation with strict TypeScript.
- The required navigation: Overview, Message Audit, Projects, SIB Factory, Staff Directory, Staff Workplan, Routines, Data & Connections, and Audit History.
- Persistent All Companies plus four organization workspace tabs.
- Official supplied logo assets at the exact public paths required by the master prompt.
- Organization-scoped accent, soft-background, and navigation colour tokens.
- Responsive desktop, compact-sidebar, and mobile-drawer layouts.
- Overview command center with source readiness, task-scope KPIs, quick paths, and decision-queue empty states.
- Dedicated source-honest screens for all required destinations.
- Canonical Google Sheet and SIB Factory links centralized in `lib/workspace-config.ts`.
- Explicit `Not verified`, unavailable-value, disabled-write, and empty states rather than fake records or zero counts.
- Authorized Google Drive connector verification for the exact `Staff Details and Task` workbook, the connected `richardc@yensbooks.com` identity, `Staffs Details`, and all nine required workplan tabs.
- A Git-ignored, server-only local Sheet snapshot adapter at `/api/google-sheet`, with production disabled by default, private no-store responses, source-schema validation, and safe unavailable states.
- Real Staff Directory records (17) and Staff Workplan rows (543), including source-row provenance, exact source organization values, conservative AIMA/SIB mapping, search, status/owner filters, and workplan pagination.
- Reconciled Overview KPIs from the active company scope, with explicit blocker/recurring flags, en-GB date parsing, and unknown statuses retained as Needs Review.
- Keyboard focus styles, skip link, labelled navigation, horizontal table overflow, reduced-motion support, and 40px-class primary controls.

## Important boundaries

- Shared mode becomes active only when Supabase and deployment secrets are configured; local mode remains the safe development fallback.
- The Gmail importer persists authorized message and readable attachment text for later audit processing; list APIs return only a bounded excerpt. Unmapped Gmail evidence is administrator-only under RLS.
- Automatic extraction of the 41 previously verified action items from message narrative is not fabricated; a structured action parser or imported verified action snapshot is still required.

- One authorized bounded Google connector read completed at `2026-08-18T04:39:16.035Z`; the app consumes its local verified snapshot and does not have runtime Google OAuth or in-app refresh.
- Supabase schema is applied, including the routine table, message attachment text, and RLS. Runtime Supabase and Google OAuth environment values are not yet present in `.env.local`, so the open local application remains in reference mode until those deployment secrets are configured.
- `data/local/google-sheet-snapshot.json` contains authorized operational data, is ignored by Git, and must never be committed. The adapter is disabled in production unless explicitly overridden; that override alone does not supply production authorization.
- External writes are disabled and the UI says so.
- Historical snapshot counts in `MASTER_PROMPT.md` are not rendered as current production counts.
- SIB Factory does not display fallback facts until a real bootstrap/fallback adapter exists.
- The in-app workspace state is intentionally non-persistent.

## Verification completed

- TypeScript: pass (`tsc --noEmit`).
- Next.js production build: pass; `/` is statically prerendered.
- Browser verification: desktop and 390px mobile layouts reviewed.
- Browser interaction checks: company switching, Message Audit navigation, mobile drawer, Data & Connections scroll reset, and SIB Factory tenant scoping passed.
- Browser console: no warnings or errors observed during the checks above.
- Local Sheet API contract: pass; exact workbook title, connected identity, 17 staff rows, 543 workplan rows, and local snapshot mapping mode returned.
- Connected browser verification: Overview KPIs reconcile to 543 total / 198 completed / 345 incomplete / 83 Needs Review / 37 blockers / 84 overdue; Data & Connections, Staff Directory, workplan pagination, blocker filtering, and explicit tenant filtering passed.

## Next engineering priority

1. Configure Supabase, Google Cloud OAuth, Vercel secrets, and the production redirect URI using `README.md`.
2. Add explicit administrator mappings for `CONTRACTOR` roster rows before exposing them in a tenant workspace.
3. Import or reproduce the verified 29-group/41-action Gmail audit snapshot without heuristic fabrication.
4. Add unit and integration tests for authorization, routine parsing, attachment extraction, status normalization, overdue logic, blocker independence, tenant filtering, and KPI reconciliation.

## Key files

- `MASTER_PROMPT.md` — product and data-contract source of truth.
- `components/dashboard-shell.tsx` — current interactive reference application.
- `app/globals.css` — responsive layout and company theming.
- `lib/workspace-config.ts` — company configuration and authoritative links.
- `lib/sheet-data.ts` — Sheet contracts, normalization, date logic, tenant mapping, and KPI calculations.
- `app/api/google-sheet/route.ts` — server-only local verified snapshot boundary.
- `data/README.md` — local source-data handling rules; `data/local/` is intentionally ignored.
- `public/company-logos/` — supplied company assets.
