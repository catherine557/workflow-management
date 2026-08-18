# Master Engineering Prompt — Workflow Management

## Role

Act as a senior product engineer, data architect, automation specialist, security engineer, and UI/UX designer. Build and maintain a responsive workflow command center for four separate organizations. Optimize for operational truth, clear accountability, safe automation, and fast human decisions.

This is not a staff scheduling product. Do not add a Staff Schedule primary tab.

## Master prompt governance

This master prompt is the source of truth for product behavior, data contracts, connector boundaries, and visual requirements. For every requested behavior change, first engineer a precise prompt delta, then implement and test that same requirement. Update this master prompt in the same checkpoint as the product change; never allow the runtime and prompt to drift.

- Convert ambiguous requests into explicit inputs, rules, outputs, failure states, and acceptance criteria before implementation.
- Preserve stricter existing safety and provenance rules unless the user explicitly replaces them.
- Record exact authoritative source links, account identities, classification rules, and supplied asset paths here.
- Never report a connector as integrated merely because its UI exists. A live source read and verified identity are required.


## Portable live-source registry and transfer contract

Registry revision: **August 18, 2026**. This section is the canonical portability manifest for every live source used by Workflow Management. Provider IDs, URLs, tab names, query boundaries, and use rules are configuration; OAuth tokens, cookies, client secrets, message bodies, transcript bodies, and copied operational rows are not. Never commit secrets or raw operational datasets to GitHub.

An implementation transferred to a new environment must bind these exact sources, verify access with the exact authorized identity, validate the schemas, and complete a successful read-only refresh before showing live data. A similarly named file, another mailbox, or an accessible lookalike is not a substitute.

### Canonical source bindings

| Configuration key | Canonical value | Authorized use | Mode |
| --- | --- | --- | --- |
| `GOOGLE_AUTHORIZED_ACCOUNT` | `catherine@yensbooks.com` | Identity required for the workplan Sheet, approved Drive routine workbooks, and Gmail-delivered Otter evidence | Identity gate |
| `WORKPLAN_SHEET_URL` | `https://docs.google.com/spreadsheets/d/1Yyo0l90Go6tdNM4SCZ9f1CI7XMiEegec3htUkzsA6wo/edit?gid=0#gid=0` | Canonical Staff Details and Task source | Read-only |
| `WORKPLAN_SHEET_ID` | `1Yyo0l90Go6tdNM4SCZ9f1CI7XMiEegec3htUkzsA6wo` | Exact workbook lookup; never replace by name search | Read-only |
| `WORKPLAN_SHEET_GID` | `0` | Canonical workbook entry link and evidence link | Read-only |
| `WORKPLAN_ROSTER_TAB` | `Staffs Details` | Staff Directory, recipient validation, owner filters, and organization/department metadata | Read-only |
| `WORKPLAN_TASK_TABS` | `Ashley, Moses, Paul, Jayce, Michael, Bella, Trisha, Christine, Richard` | Overview KPIs, Staff Workplan, Projects, assignments lookup, and source evidence | Read-only |
| `WORKPLAN_TIMEZONE` | `America/Winnipeg` | Date parsing and source-local display | Read-only |
| `WORKPLAN_LOCALE` | `en_GB` | Date and value parsing while retaining source strings | Read-only |
| `ROUTINE_CHRISTINE_ID` | `1vWu4a3zroXvejKFs89sybe3uZWCQDuZpDClutf43WHs` | Christine Routine; approved Daily, Weekly, and Monthly sheets only | Read-only |
| `ROUTINE_BELLA_ID` | `1ZrFaKNVXNWwE_TP2gGMjurztVy9txg0kPd6B1l14PVI` | Bella Routine; approved Daily, Weekly, and Monthly sheets only | Read-only |
| `ROUTINE_ASHLEY_ID` | `1Sqti0LnpoBPzapPh4OG4u-QlOeergDEuS-6sOGYdO7Y` | Ashley Routine; approved Daily, Weekly, and Monthly sheets only | Read-only |
| `ROUTINE_TRISHA_ID` | `1zk5UGy-GA15nepfrbm_MR0wJVmlIjGLJoOMEfvbMVmc` | Trisha Routine; approved Daily, Weekly, and Monthly sheets only; exclude `Sheet5` | Read-only |
| `OTTER_GMAIL_QUERY` | `in:anywhere otter -in:spam -in:trash` | Bounded discovery of Otter-delivered Gmail evidence; results require sender and content verification | Read-only |
| `OTTER_READABLE_EVIDENCE` | `Gmail body, .eml, .txt, .docx` | Message Audit evidence and validated project subtasks | Read-only |
| `SIB_MASTER_PROMPT_URL` | `https://github.com/shellysbistro/shellys-rte-command-centre/blob/main/MASTER_BUILD_PROMPT.md` | Optional Shelly's Bistro project evidence, research assignments, and current-versus-proposed source facts | Read-only, no-cache |
| `COMPANY_LOGO_PATHS` | `/company-logos/audit-expert.png, /company-logos/yens-and-santos.png, /company-logos/aima.png, /company-logos/shellys-bistro.png` | Company tabs and selected-company identity only | Bundled assets |

The routine workbook URL is derived only as `https://docs.google.com/spreadsheets/d/{ROUTINE_*_ID}/edit`; the stored workbook ID remains the lookup authority. Source IDs and URLs may be exposed in an administrator-only Connections view, but credentials and provider tokens must remain server-side.

### Live source-to-feature data-use map

| Source record set | Permitted product uses | Explicit exclusions |
| --- | --- | --- |
| `Staffs Details` roster rows | Staff Directory; real recipient validation; staff-owner filtering; role, department, email, and source organization display; staff-to-organization mapping | Never infer a missing organization, role, or email; never create a person from an Otter participant name |
| Nine workplan tabs | Staff Workplan; Overview KPIs; project-type classification; project task membership; due-date and workload signals; source evidence | Community is metadata only; no invented project seeds, dates, blockers, completion times, or write-back |
| Four approved routine workbooks | Routines tab; owner/cadence/section grouping; schedule, category, source status, notes, and provenance | Do not turn routines into workplan tasks, deadlines, attendance, or projects; exclude headings and unrelated sheets |
| Gmail-delivered Otter evidence | Message Audit coverage; visible action extraction; source-group audit; proposed tasks; evidence-linked project subtasks after duplicate control and human recipient validation | Link-only Otter pages are not transcript text; no hidden action inference; no auto-issuance; do not expose unrelated sensitive narrative |
| Shelly's Bistro GitHub master prompt | Optional project evidence, R01–R12 research assignments, source version, current-versus-proposed facts, and fallback-status display | It is not a primary tab; proposed funding, sites, capacity, partners, or research findings must not be shown as current or secured |
| Bundled company logos and theme tokens | Company navigation, selected-company branding, and accessible scoped themes | Do not use branding assets as authorization or organization-classification evidence |

Every source-derived record must be scoped to an explicit organization identifier before tenant display. Source-provided organization values may be mapped by an administrator, but organization must never be inferred from a staff name, workbook filename, community, email wording, or adjacency.

### Universal provenance contract

Persist these fields, when supported, for every imported or derived record:

- `source_system`, `source_account`, `source_id`, `source_title`, and `source_type`;
- `source_container_id`, `source_tab_or_attachment`, `source_row_or_message_id`, and `source_url`;
- `source_revision_or_modified_at`, `retrieved_at`, `last_successful_refresh_at`, and `access_result`;
- original source values, mapped organization identifiers, schema version, and snapshot state;
- for Gmail: thread ID, message ID, attachment filename, attachment content hash when available, evidence kind, sender-verification result, and duplicate-group key;
- for derived project classification: normalized project type, similarity score, matched terms, contributing fields, rationale, classifier version, and derivation time.

Normalized or classified values must be stored separately from immutable source values. Every displayed count must be reproducible from the same filtered record set and traceable to the last successful refresh.

### Read-only connector scopes and secret boundary

Request only the minimum server-side permissions required for the enabled sources, normally Google Sheets read-only, Google Drive read-only, and Gmail read-only. Do not request provider write scopes while the product write adapters are disabled.

Never commit or expose:

- OAuth access or refresh tokens, cookies, passwords, API keys, client secrets, or provider error payloads;
- raw workbook exports, copied staff/workplan rows, Gmail bodies, transcript bodies, attachment contents, or personal/medical/HR narrative;
- production snapshots, local caches, audit logs with personal data, or unredacted connector diagnostics.

An optional `GITHUB_TOKEN` for private SIB source access is a server-side secret and must never have a value in this prompt, the client bundle, logs, screenshots, or repository history.

### Transfer bootstrap and refresh sequence

A transferred deployment must run this sequence before claiming a source is live:

1. Load non-secret source configuration from this registry and load credentials from the destination secret manager.
2. Verify the authenticated Google identity equals `catherine@yensbooks.com`.
3. Resolve each approved source by exact ID or exact URL; do not begin with broad filename or mailbox discovery.
4. Run a bounded metadata read and verify access, workbook title, required tabs, locale/timezone, required columns, and supported attachment types.
5. Apply explicit organization mappings and authorization before content enters a tenant view.
6. Import only the approved content boundary, retain original values, normalize separately, and run duplicate control.
7. Recompute validation, status, project classification, counts, and coverage from the current source; do not copy prior snapshot totals into runtime logic.
8. Persist the successful snapshot and provenance, then publish its counts and refresh time atomically.
9. If any later refresh fails, retain the prior snapshot only as `Stale snapshot`, record the failed attempt separately, and show the safe remediation.

Snapshot counts in this prompt are verification evidence, not seed data. The August 17, 2026 counts may be used as migration smoke-test expectations only; a transferred system must replace them with counts from its own verified refresh.

### Transfer acceptance checklist

Before a transferred deployment is accepted:

- the canonical workbook resolves by ID and the roster/workplan schema matches;
- all four routine workbook IDs resolve and only approved routine sheets import;
- Gmail is authenticated as `catherine@yensbooks.com`, the bounded query runs, and sender/content validation filters false positives;
- optional Shelly's Bistro GitHub evidence reports its live source version or a visible fallback state without adding a primary tab;
- every tenant-visible record has explicit organization authorization and complete minimum provenance;
- connector health distinguishes `Not verified`, `Connected`, `Healthy`, `Account mismatch`, `Access needed`, `Stale snapshot`, `Degraded`, and `Blocked`;
- no source write occurs, no secret reaches the client or repository, and no raw live dataset is bundled for portability;
- the runtime behavior and this master prompt pass the same acceptance criteria in the destination environment.

## Non-negotiable data rule

Use real, authorized source records only.

- Never create demo people, sample messages, fictional projects, random tasks, guessed dates, assumed completion timestamps, or fabricated KPI values.
- When a value is absent, show “Not provided”, “Not connected”, “Needs mapping”, or “Needs Review”, as appropriate.
- Preserve source spelling and provenance even when a normalized display value is also needed.
- Do not claim a write occurred in Google Sheets, Gmail, or Otter unless the corresponding adapter confirms it.
- Empty states are valid product states. Explain what source or authorization is needed to populate them.

## Organization workspaces

Support exactly these four workspaces:

1. Audit Expert
2. Yens and Santos
3. Accurate Indigenous Managers and Advisors (AIMA)
4. Shelly's Bistro

Every tenant-owned record must carry one or more explicit organization identifiers. Never infer an organization from a person's name or task wording. A combined view is limited to a verified System Administrator. Enforce authorization on the server and in the persistence layer; hidden navigation is not authorization.

Render these workspaces as persistent, colour-coded company tabs rather than an organization dropdown. Include a clearly selected state, keyboard focus, horizontal scrolling on small screens, and an authorized All Companies tab for the combined command center.

## Authoritative Google Sheet

Use the connected workbook **Staff Details and Task**:

`https://docs.google.com/spreadsheets/d/1Yyo0l90Go6tdNM4SCZ9f1CI7XMiEegec3htUkzsA6wo/edit?gid=0#gid=0`

This exact URL is the canonical live workplan-and-task link. Store it in application configuration and reuse it for source evidence and optional reviewable staff-email drafts. Do not silently replace the workbook or `gid` with a similarly named source.

Workbook timezone: `America/Winnipeg`. Workbook locale: `en_GB`.

Roster tab: `Staffs Details`

- All Staff
- Organization
- Role
- Department
- Email

Workplan tabs:

- Ashley
- Moses
- Paul
- Jayce
- Michael
- Bella
- Trisha
- Christine
- Richard

Workplan columns:

- Current Assignment
- Cat Notes
- Original Due Date
- New Due Date
- Community
- Collaborator
- Status
- Notes
- New Assignment

Retain workbook ID, tab, source row, original value, source link, refresh time, and original status. Parse dates according to the workbook locale while preserving the source string. Treat the Sheet as read-only until stable IDs, write authorization, idempotency, concurrency checks, and conflict handling are implemented.

At the current verified snapshot, the workbook contains 17 roster rows and 543 workplan rows. Counts must be refreshed from the source rather than hard-coded into production behavior.

## Authorized Google Drive evidence

Google Drive is an approved read-only discovery and evidence source. It is not a blanket authorization to ingest every accessible file.

- Verify and display the connected Google identity before reading file content.
- Require an administrator to map each approved Drive file or folder to one or more explicit organization identifiers before its records appear in the dashboard.
- Search by the configured file or folder identifier first. Do not substitute a similarly named file when the authoritative target is unavailable.
- Retain Drive file ID, title, MIME type, parent folder, source URL, revision or modified time, mapped organization, retrieval time, and access result.
- Use metadata-only discovery until a file is explicitly approved for content extraction.
- Treat Docs, Sheets, PDFs, Office files, images, audio, archives, and shortcuts according to their real MIME type. Never claim unsupported or unreadable content was parsed.
- Minimize sensitive content in list views. File titles and excerpts may be shown only when authorized for the active organization and role.
- Drive remains read-only. Rename, move, share, upload, replace, or delete actions are out of scope unless a separately authorized write workflow is implemented and audited.

### Approved routine workbooks

The following four Drive-backed workbooks are explicitly approved read-only routine sources:

- Christine Routine — Drive locator `1vWu4a3zroXvejKFs89sybe3uZWCQDuZpDClutf43WHs`
- Bella Routine — Drive locator `1ZrFaKNVXNWwE_TP2gGMjurztVy9txg0kPd6B1l14PVI`
- Ashley Routine — Drive locator `1Sqti0LnpoBPzapPh4OG4u-QlOeergDEuS-6sOGYdO7Y`
- Trisha Routine — Drive locator `1zk5UGy-GA15nepfrbm_MR0wJVmlIjGLJoOMEfvbMVmc`

Import only sheets whose names identify Daily, Weekly, or Monthly routine content. Treat rows with a task label and no schedule, category, status, or notes as schedule-section headings, not tasks. Exclude unrelated historical or audit worksheets, including Trisha's `Sheet5`, from the Routines tab. Preserve workbook name, sheet name, source row, staff owner, cadence, schedule, category, source status, and notes. Excel time fractions must be rendered as readable local times. At the August 17, 2026 verified snapshot, the four workbooks contain 159 routine tasks: Christine 43, Bella 39, Ashley 41, and Trisha 36.

## Connector identity and refresh contract

Google Sheets, Gmail, and Google Drive adapters must verify the authenticated account before any source read. A successful OAuth connection is not the same as authorization for the requested source.

- Compare the connected account with the source-specific authorized identity and organization mapping.
- If an account is connected but does not match the authorized identity, show `Account mismatch`; do not import records.
- If the identity is correct but the file or mailbox is inaccessible, show `Access needed` and the exact safe remediation.
- If a connector has never completed a verified read, show `Not verified`, not Healthy.
- Show `Connected` or `Healthy` only after a current identity check and a successful bounded read of the authoritative source.
- Persist last successful refresh separately from last attempted refresh. Keep the prior verified snapshot labelled `Stale snapshot` when a later attempt fails.
- Do not broaden searches, select lookalike files, switch mailboxes, or fall back to unrelated Drive records after an access error.
- Connector reads run server-side with least-privilege scopes. OAuth tokens, refresh tokens, cookies, and provider error payloads must never be returned to the browser.

## Information architecture

Primary tabs, in this order:

1. Overview
2. Message Audit
3. Projects
4. Staff Directory
5. Staff Workplan
6. Routines
7. Data & Connections
8. Audit History

Do not add separate SIB Factory, Staff Schedule, or Review Queue tabs. Routines is recurring responsibility evidence, not a staff schedule. Message Audit contains its own validation result and explicit human task-issuance action. Shelly's Bistro remains a company workspace; its verified work appears through Overview, Projects, Staff Workplan, and Data & Connections.

## Overview command center

The landing page is an interactive workflow command center. It must offer quick paths to find staff, manage workplans, audit an email or transcript, inspect projects, view exceptions, and export the filtered task register.

Filters:

- organization;
- source department;
- staff owner;
- project type;
- normalized status;
- blocker state;
- due-date range;
- source.

KPIs:

- Total tasks
- Completed
- Incomplete
- Needs Review
- Blockers
- Overdue

All values must reconcile to the same filtered task set. `Incomplete = status != Done`. A task is overdue only when a valid due date is earlier than today and the task is not Done. A blocker requires an explicit source signal. Do not infer blockers from lateness. Do not render a completion trend without reliable completion timestamps; show an explanatory empty state instead.

## Staff Directory

Use only records from `Staffs Details`. Show approved operational fields: name, source organization, explicit organization mappings, source role, source department, work email, source row/link, mapping status, and workplan counts.

Support organization and department filters, text search, source evidence, workload signals, Assign Task, Email Staff, and View Workplan.

Assign Task must require a real Sheet staff record, explicit authorized organization, task name, optional due date, normalized status, and optional notes. Dashboard-side assignments must be labeled as pending Sheet write-back and audited.

Email Staff must use the roster work email. Create a reviewable draft only; never send automatically. Allow the configured Google Sheet link to be included. Audit the recipient, organization, subject, link choice, actor, draft ID, and time.

## Staff Workplan

Unify the nine staff task tabs while retaining exact provenance. Provide search, filters, sorting, pagination, owner workload, KPIs, source status, normalized status, source row, and a detail drawer.

Normalize recognized task statuses only:

- completed/done/closed → Done
- pending/not started/open → Pending
- active/in progress/recurring/blocker → In Progress

Keep blocker and recurring flags independent. Blank or unknown status → Needs Review. Do not silently place it in Pending or In Progress.

## Routines

Routines is a primary read-only tab for the explicitly approved Christine, Bella, Ashley, and Trisha workbooks.

- Provide staff switching, text search, and All/Daily/Weekly/Monthly cadence filters.
- Group routine tasks by the real section heading captured from the workbook while keeping owner, cadence, schedule, category, status, notes, file, sheet, and row provenance.
- Do not convert routines into workplan tasks or project deadlines.
- Do not present section headings as tasks.
- Do not import unrelated sheets simply because they are in the same workbook.
- Routines may show recurring and monthly source states, but it must not invent completion or attendance data.

## Projects

Projects must be derived from the Google Sheet workplan plus verified Gmail/Otter action items whose wording is visible in authorized evidence. Never use a project seed.

- Normalize and sort project groups by project type; never group or order projects by community.
- Detect the project type deterministically across `Current Assignment`, `New Assignment`, `Cat Notes`, and `Notes`, weighting assignment-title fields more strongly than notes.
- After detecting project type, place a task under a project only when task-title or note similarity meets the documented threshold. Retain the score, matched terms, contributing fields, confidence, and rationale in the UI.
- Never use `Community` as a project key, classification signal, or grouping field. Retain it only as source community metadata.
- When no project-type evidence exists, use the explicit review bucket `Needs Classification`; do not guess.
- When similarity is below threshold or conflicting types have no clear winner, use `Needs Classification`; do not infer from a person name, organization, community, or adjacency in the Sheet.
- A human-confirmed project type on a dashboard-issued task may override the classifier and must be labeled `Human selected`.
- Evidence-linked Otter actions may appear as project subtasks only after duplicate control. Preserve their Gmail/EML source, source owner, original action wording, and `Needs Review` state until a human maps a real recipient. Do not let an Otter action silently replace or mutate a Sheet workplan row.
- Show grouped task count, real staff owners, departments, organization mapping, latest available task due date, representative task notes, task-based progress, and derived status.
- Do not show invented project numbers, start dates, project deadlines, manual progress, project notes, calendar bars, or delivery forecasts.

Derived project status:

- all tasks Done → Done;
- any task In Progress → Current;
- otherwise any task Pending → Pending;
- otherwise → Needs Review.

## Shelly's Bistro source handling

Do not create a dedicated SIB Factory primary tab. Shelly's Bistro is one of the four company workspaces, not a fifth organization or authorization tenant. Its verified Sheet tasks must be available through the shared Overview, Projects, and Staff Workplan experiences. Its optional read-only product evidence source is:

`https://github.com/shellysbistro/shellys-rte-command-centre/blob/main/MASTER_BUILD_PROMPT.md`

When this source is enabled, request the raw `main/MASTER_BUILD_PROMPT.md` with `Cache-Control: no-store` behavior. Surface its version and safe status through Data & Connections or a Shelly's Bistro project detail, not a primary navigation destination. Never treat proposed funding, site, capacity, partnerships, or research results as current or secured.

If GitHub is unavailable or private, show a visible `Fallback snapshot` state using the bundled August 15, 2026 last-known-good facts. Display the last checked time and safe error; never silently present fallback data as live. Support optional server-side `GITHUB_TOKEN`; never expose it to the browser.

Combine approved source evidence with verified Shelly's Bistro Sheet tasks only inside the shared project-type similarity engine. Keep GitHub requirements, conceptual research assignments, and Sheet workplan tasks visually distinct.

## Message Audit

Message Audit accepts authorized Gmail evidence or Otter transcript evidence. A connector may submit source records automatically later; the current manual intake must enforce the same data contract.

Required audit inputs:

- source type: Gmail or Otter;
- exact source title;
- minimal evidence excerpt;
- explicit organization;
- real staff recipient from `Staffs Details`;
- proposed task name.

Optional inputs:

- source location or transcript timestamp;
- authorized source link;
- due date;
- verified project type when present in the source.

The audit must check source type, required evidence, task wording, organization authorization, real staff identity, staff-to-organization mapping, and date format. Save every error. A record with errors is `Needs correction`; a valid record is `Ready to issue`.

Never create a task during evidence intake. The user must click `Issue task`. Issuance creates a dashboard-side assignment, links source evidence, records the audit event, changes the audit record to `Issued`, and prevents duplicate issuance. Google Sheet write-back remains explicitly disabled until a real write adapter is authorized.

### Otter action-register behavior

The authorized mailbox for the current live workplan and Otter audit is `catherine@yensbooks.com`. Message Audit must expose the task register recovered from Gmail-delivered Otter evidence, including email bodies, nested `.eml` messages, and readable `.txt` and `.docx` attachments. A connector authenticated as any other account must show `Account mismatch` and import no message or transcript content.

The authorized mailbox was re-audited live on August 17, 2026 with the bounded query `in:anywhere otter -in:spam -in:trash`. The search returned 62 hits, including false positives caused by Gmail matching “other.” Sender verification found 21 direct Otter messages. Direct message bodies plus readable nested EML produced 29 unique task-related source groups and 41 action items whose wording is actually visible. Thirteen groups are coverage-only because no action wording is visible. These counts describe this verified snapshot and must be refreshed rather than hard-coded into connector behavior.

- Group tasks by their source email or attachment while retaining a flat searchable audit register.
- Preserve the exact mailbox account, Gmail message link, attachment filename, meeting date, source owner, evidence kind, proposed task, organization, project type, and staff-recipient mapping.
- Label evidence as `Explicit action item`, `Transcript assignment`, `Transcript commitment`, or `Summary-stated task`.
- A summary-stated task must remain `Needs correction` until a human confirms its wording against the full transcript.
- Never replace an unverified source owner with a convenient staff member. If Catherine, Dee Dee/Didi, Princely, James, Mira, an external participant, or an unnamed role is not a matching `Staffs Details` row, preserve the source owner and require a verified recipient selection.
- A mapped recipient is ready only when the source supports the task wording and the real Sheet staff record is authorized for the selected organization.
- Disclose every unreadable or incomplete source instead of guessing. Current live limitations include search false positives, action items hidden behind Otter links, “unable to record” notices, invitations or upcoming-meeting notices without transcript content, and coverage-only request notices.
- Otter API pages, shared-note links, and link-only email references are not transcript content. Import transcript text only when it is present in the authorized Gmail body or a readable `.eml`, `.txt`, or `.docx` attachment.
- HR and employment records are sensitive. Keep evidence excerpts to the minimum needed for the task, require administrator access, and never expose unrelated narrative or medical/personal details in table views.
- Forwarded duplicates and duplicate versions of the same attachment must not create duplicate tasks.

## Data & Connections

Show the verified Google Sheet source and honest connector states:

- Staff Details and Task Sheet: read-only; Healthy only after the named workbook is accessible and the required tabs are verified;
- Google Drive: read-only discovery; show the connected identity and the count of explicitly mapped sources, never the count of every accessible file;
- Gmail: `catherine@yensbooks.com`, read-only after explicit user approval and an exact account-identity match;
- Otter: connected through authorized Gmail-delivered EML, TXT, and DOCX evidence; read-only. ZIP and MP3 limitations are disclosed.
- GitHub: optional Shelly's Bistro master-prompt evidence, refreshed with no-cache when enabled; degraded when the last-known-good snapshot is in use; never represented as a dedicated primary tab.

Display connected identity, last attempted refresh, last successful refresh, record counts, mapping mode, safe errors, and write mode. Disabled controls must clearly explain why a source cannot sync. OAuth secrets must never be entered into or returned to the browser.

## Audit History

Record material dashboard-side actions: evidence audits, task issuance, staff assignments, email drafts, source verification, and configuration changes. Each event includes organization, actor, action, entity type, entity ID, details, and timestamp. Do not manufacture initial audit events.

## Security and production boundary

Use authenticated server sessions in production. Apply organization and role authorization on every API query and mutation. Store OAuth refresh tokens in a managed secret service. Use least-privilege scopes, encrypted transport, request-size limits, safe error messages, output encoding, CSRF protection for cookie sessions, and auditable confirmation for external writes.

The local reference build may keep mutations in memory, but it must say so. In-memory task issuance and email drafting are not equivalent to external delivery.

## UI requirements

- Product name is `Workflow Management` in the page title, sidebar brand, documentation, and runtime output.
- The UI must be clean, calm, and decision-focused: strong visual hierarchy, generous spacing, compact but legible cards, consistent alignment, and no decorative clutter.
- Responsive desktop and mobile layouts with a colourful but accessible multi-company theme. All eight primary destinations remain reachable on small screens.
- Use the supplied official company logos in the persistent company tabs and selected-company overview identity: `/company-logos/audit-expert.png`, `/company-logos/yens-and-santos.png`, `/company-logos/aima.png`, and `/company-logos/shellys-bistro.png`. Do not redraw, substitute, or recolour the logos. The All Companies tab uses a neutral `WM` mark.
- Change the scoped accent, soft background, and navigation colour tokens when the selected company changes: Audit Expert uses orange and slate; Yens and Santos uses gold and navy; AIMA uses teal and charcoal; Shelly's Bistro uses magenta and deep plum. Preserve accessible contrast and pair every state colour with text.
- Use a restrained neutral canvas, one primary action colour, and the organization colours as scoped accents rather than full-page fills.
- Use a 16px reading baseline for body copy, descriptions, form controls, and primary operational text. Navigation, tables, cards, projects, routines, connection details, and task text must render at 14px or larger; secondary metadata may render at 12–13px only when contrast and spacing remain strong. Major page headings use at least 30px, section headings use at least 18px, and primary touch targets are at least 42px high.\n- Treat text below 12px as a release-blocking accessibility defect. Increasing type must also increase the surrounding control height, card spacing, table width, and responsive navigation height so text never clips, overlaps, or becomes unreadably dense.
- Wrap long organization names, task names, source titles, notes, and connector details without clipping. Keep tables horizontally scrollable when wrapping would destroy their structure.
- Keep the first viewport focused on source health, urgent operational choices, the shared task scope, and clear next actions.
- Keyboard-operable navigation, tables, dialogs, and actions.
- High-contrast labels; never communicate state by colour alone.
- Plain-language loading, empty, validation, disabled, and error states.
- Clearly distinguish `Connected`, `Healthy`, `Account mismatch`, `Access needed`, `Stale snapshot`, `Degraded`, and `Blocked` with text labels as well as colour.
- Source links open in a new tab with safe link attributes.
- Filters update the screen immediately and retain one consistent record scope.
- Tables support horizontal overflow on small screens.
- No fake avatars, fabricated profile data, or decorative charts without source data.

## Acceptance criteria

1. Staff Schedule and Review Queue are absent from primary navigation.
2. The four organization workspaces are visible to the authorized combined session.
3. Staff Directory contains only the 17 verified Sheet staff records at the current snapshot.
4. Staff Workplan contains all 543 verified rows at the current snapshot and labels unknown states Needs Review.
5. Overview KPIs reconcile exactly to the filtered workplan.
6. Projects are grouped by explainable task/name note similarity; Community never determines the project and unresolved rows appear as `Needs Classification`.
7. SIB Factory is absent from desktop and mobile primary navigation; Shelly's Bistro remains a company workspace whose verified tasks appear through shared Overview, Projects, and Staff Workplan views.
8. Message Audit contains the August 17, 2026 verified live snapshot of 29 unique Otter source groups and 41 visible action items, retains 13 coverage-only groups without manufacturing tasks, and records the 62-hit search boundary.
9. An invalid message audit saves its real validation errors and cannot issue a task.
10. A valid message audit referencing a real staff record can issue exactly one dashboard task by button click.
11. Staff email actions create a draft and include the configured Sheet link when selected; they do not send.
12. Gmail displays Healthy only for the exact authorized `catherine@yensbooks.com` account. Any other connected account displays Account mismatch and imports no workplan or Otter records.
13. Google Drive displays the connected identity, remains read-only, and loads content only from explicitly approved files or folders with organization mappings.
14. Otter displays Healthy only through the authorized Gmail relay and discloses the four current coverage limitations.
15. No synthetic staff, tasks, projects, messages, schedules, counts, or timestamps appear anywhere in the product.
16. The exact canonical Sheet link ends in `edit?gid=0#gid=0` everywhere it is stored or presented.
17. The four supplied company logos appear in company tabs, selected-company themes change immediately, and long labels wrap without clipping at desktop and mobile widths.
18. Routines contains exactly the 159 verified routine tasks from the four approved workbooks; section headings and Trisha's non-routine `Sheet5` are excluded.
19. Projects combine the 543 Sheet rows and 41 visible Otter actions under project-type groups while retaining source provenance; Community is metadata only.
20. Every behavior change ships with a matching engineered update to this master prompt and is validated against its acceptance criteria.
21. A transferred deployment can reconstruct every live-source binding and permitted data use from the portable registry, while credentials and raw operational records remain outside GitHub.\n22. Desktop and mobile views use the enlarged typography scale: 16px reading text, 14px-or-larger operational text, 12px minimum metadata, 30px-or-larger page headings, and no clipped or overlapping labels after responsive wrapping.
