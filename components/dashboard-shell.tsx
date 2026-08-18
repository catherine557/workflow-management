"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Blocks,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  Cloud,
  Database,
  Download,
  ExternalLink,
  Factory,
  FileCheck2,
  Filter,
  History,
  Inbox,
  LayoutDashboard,
  Link2,
  MailCheck,
  Menu,
  Network,
  PanelLeftClose,
  RefreshCw,
  Search,
  Send,
  Share2,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  UserRoundSearch,
  UserPlus,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  effectiveDueDate,
  effectiveTaskStatus,
  hasExplicitBlocker,
  isExplicitlyRecurring,
  normalizeTaskStatus,
  sourceOrganizationCompanyIds,
  staffMatchesCompany,
  taskAssignment,
  taskMatchesCompany,
  taskMetrics,
  taskOwnerStaff,
  todayInTimeZone,
  type NormalizedTaskStatus,
  type SheetSnapshot,
} from "@/lib/sheet-data";
import {
  companies,
  GOOGLE_AUTHORIZED_EMAIL,
  SHEET_SOURCE_URL,
  SIB_FACTORY_SOURCE_URL,
  type Company,
  type CompanyId,
} from "@/lib/workspace-config";
import type { RoutineRecord } from "@/lib/routine-data";

type ViewId =
  | "overview"
  | "message-audit"
  | "projects"
  | "sib-factory"
  | "staff-directory"
  | "staff-workplan"
  | "routines"
  | "connections"
  | "audit-history";

type NavigationItem = {
  id: ViewId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const navigation: NavigationItem[] = [
  { id: "overview", label: "Overview", description: "Shared command center", icon: LayoutDashboard },
  { id: "message-audit", label: "Message Audit", description: "Validate source evidence", icon: MailCheck },
  { id: "projects", label: "Projects", description: "Evidence-linked work", icon: BriefcaseBusiness },
  { id: "sib-factory", label: "SIB Factory", description: "Bistro factory operations", icon: Factory },
  { id: "staff-directory", label: "Staff Directory", description: "Verified roster", icon: UsersRound },
  { id: "staff-workplan", label: "Staff Workplan", description: "Unified task register", icon: ClipboardCheck },
  { id: "routines", label: "Routines", description: "Recurring responsibilities", icon: CalendarClock },
  { id: "connections", label: "Data & Connections", description: "Source health", icon: Database },
  { id: "audit-history", label: "Audit History", description: "Material actions", icon: History },
];

const metricLabels = ["Total tasks", "Completed", "Incomplete", "Needs Review", "Blockers", "Overdue"];

const sourceStates = [
  { name: "Staff Details and Task", detail: "Roster and workplan", icon: TableProperties },
  { name: "Google Drive", detail: "Approved routine files", icon: Cloud },
  { name: "Gmail / Otter", detail: "Authorized message evidence", icon: Inbox },
  { name: "SIB Factory source", detail: "GitHub master prompt", icon: Factory },
];

type SheetState =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: SheetSnapshot }
  | { kind: "error"; message: string };

type DashboardViewer = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor" | "viewer";
  organizationIds: CompanyId[];
};

type ConnectorStatus = {
  identityEmail: string | null;
  identityName: string | null;
  status: string;
  lastAttemptedAt: string | null;
  lastSuccessfulAt: string | null;
  safeError: string | null;
  recordCounts: Record<string, number>;
};

type SharedStatus = {
  mode: "local" | "shared";
  connector: ConnectorStatus | null;
  localImportAvailable?: boolean;
};

type MessageSummary = {
  id: string;
  gmail_thread_id: string;
  source_title: string;
  sender: string;
  sent_at: string | null;
  evidence_kind: string;
  evidence_excerpt: string;
  attachment_names: string[];
  source_url: string;
  refreshed_at: string;
};

type MessageState =
  | { kind: "loading" }
  | { kind: "ready"; messages: MessageSummary[]; count: number }
  | { kind: "error"; message: string };

type RoutineState =
  | { kind: "loading" }
  | { kind: "ready"; routines: RoutineRecord[]; count: number }
  | { kind: "error"; message: string };

type AuditEvent = {
  id: string;
  organization_ids: CompanyId[];
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
};

type AuditState =
  | { kind: "loading" }
  | { kind: "ready"; events: AuditEvent[] }
  | { kind: "error"; message: string };

type StatusTone = "neutral" | "healthy" | "done" | "pending" | "progress" | "review" | "blocked";

function formatRefreshTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not provided"
    : new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Winnipeg",
      }).format(date);
}

function statusTone(status: NormalizedTaskStatus): StatusTone {
  if (status === "Done") return "done";
  if (status === "Pending") return "pending";
  if (status === "In Progress") return "progress";
  return "review";
}

function CompanyMark({ company, compact = false }: { company: Company; compact?: boolean }) {
  if (!company.logo) {
    return <span className={`company-mark wm-mark ${compact ? "compact" : ""}`}>WM</span>;
  }

  return (
    <span className={`company-mark ${compact ? "compact" : ""}`}>
      <Image src={company.logo} alt="" width={48} height={48} sizes={compact ? "33px" : "48px"} />
    </span>
  );
}

function StatusPill({ children = "Not verified", tone = "neutral" }: { children?: string; tone?: StatusTone }) {
  return (
    <span className={`status-pill status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  copy,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-panel">
      <span className="empty-icon" aria-hidden="true">
        <Icon size={23} strokeWidth={1.8} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
      {action && onAction ? (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      ) : null}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children ? <div className="heading-actions">{children}</div> : null}
    </header>
  );
}

function Overview({ company, setView, sheetState }: { company: Company; setView: (view: ViewId) => void; sheetState: SheetState }) {
  const snapshot = sheetState.kind === "ready" ? sheetState.snapshot : null;
  const scopedTasks = snapshot
    ? snapshot.tasks.filter((task) => taskMatchesCompany(task, snapshot.staff, company.id))
    : [];
  const metrics = snapshot
    ? taskMetrics(scopedTasks, todayInTimeZone(snapshot.source.timeZone))
    : null;
  const metricValues = metrics
    ? [metrics.total, metrics.completed, metrics.incomplete, metrics.needsReview, metrics.blockers, metrics.overdue]
    : [];
  const launchItems: Array<{
    title: string;
    copy: string;
    icon: LucideIcon;
    view: ViewId;
    badge: string;
  }> = [
    {
      title: "Find staff",
      copy: "Search the verified roster, review workload, and open a workplan.",
      icon: UserRoundSearch,
      view: "staff-directory",
      badge: "Roster",
    },
    {
      title: "Manage workplans",
      copy: "Filter source tasks and inspect exact Sheet provenance.",
      icon: ClipboardCheck,
      view: "staff-workplan",
      badge: "Tasks",
    },
    {
      title: "Audit a message",
      copy: "Validate Gmail or Otter evidence before a task is issued.",
      icon: MailCheck,
      view: "message-audit",
      badge: "Evidence",
    },
    {
      title: "Inspect projects",
      copy: "See explainable project grouping after source verification.",
      icon: BriefcaseBusiness,
      view: "projects",
      badge: "Projects",
    },
  ];

  return (
    <>
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-identity">
            <CompanyMark company={company} />
            <div>
              <span className="hero-kicker">Active workspace</span>
              <strong>{company.name}</strong>
            </div>
          </div>
          <h1>Turn verified work into clear next actions.</h1>
          <p>
            {snapshot
              ? "The identity-checked Google Sheet snapshot now powers the roster and workplan. Every value keeps its source row, and external writes remain disabled."
              : "Source health, workload, exceptions, and evidence stay in one accountable view. Connect an approved source to begin—no sample records are shown."}
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setView("connections")}>
              Review connections
              <ArrowRight size={17} />
            </button>
            <a className="secondary-button" href={SHEET_SOURCE_URL} target="_blank" rel="noreferrer">
              Open workplan source
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
        <div className="hero-health" aria-label="Source readiness summary">
          <div className="health-heading">
            <div>
              <span>Source readiness</span>
              <strong>{snapshot ? "1 verified source" : sheetState.kind === "loading" ? "Checking local source" : "Verification required"}</strong>
            </div>
            <span className="health-glyph"><Activity size={20} /></span>
          </div>
          <div className="health-list">
            {sourceStates.map(({ name, detail, icon: Icon }, index) => (
              <div className="health-row" key={name}>
                <span className="source-icon"><Icon size={17} /></span>
                <span className="health-source"><strong>{name}</strong><small>{detail}</small></span>
                {index === 0 && snapshot ? <StatusPill tone="healthy">Healthy</StatusPill> : <StatusPill>{index === 0 && sheetState.kind === "loading" ? "Checking" : undefined}</StatusPill>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block" aria-labelledby="kpi-heading">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Shared task scope</p>
            <h2 id="kpi-heading">Workplan pulse</h2>
          </div>
          <span className="scope-label"><Filter size={14} /> {company.shortName}</span>
        </div>
        <div className="metric-grid">
          {metricLabels.map((label, index) => (
            <article className="metric-card" key={label}>
              <div className="metric-top"><span>{label}</span><CircleGauge size={17} /></div>
              <strong aria-label={metrics ? undefined : `${label} unavailable`}>{metrics ? metricValues[index] : "—"}</strong>
              <small>{metrics ? `${scopedTasks.length} source rows in scope` : "Awaiting a verified Sheet read"}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="section-block launch-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quick paths</p>
              <h2>What do you need to do?</h2>
            </div>
          </div>
          <div className="launch-grid">
            {launchItems.map(({ title, copy, icon: Icon, view, badge }) => (
              <button className="launch-card" key={title} onClick={() => setView(view)}>
                <span className="launch-icon"><Icon size={20} /></span>
                <span className="launch-content"><small>{badge}</small><strong>{title}</strong><span>{copy}</span></span>
                <ArrowRight className="launch-arrow" size={18} />
              </button>
            ))}
          </div>
        </div>

        <aside className="section-block decision-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Decision queue</p>
              <h2>Needs your attention</h2>
            </div>
          </div>
          {metrics ? (
            <div className="decision-summary">
              <div><span>Explicit blockers</span><strong>{metrics.blockers}</strong></div>
              <div><span>Overdue, not done</span><strong>{metrics.overdue}</strong></div>
              <div><span>Needs review</span><strong>{metrics.needsReview}</strong></div>
              <button className="text-button" onClick={() => setView("staff-workplan")}>Review task register <ArrowRight size={16} /></button>
            </div>
          ) : (
            <EmptyPanel
              icon={ShieldCheck}
              title="No verified snapshot yet"
              copy="Exceptions will appear only after a successful, identity-checked source read."
              action="Check source access"
              onAction={() => setView("connections")}
            />
          )}
          <div className="decision-note">
            <AlertCircle size={16} />
            <span>Late tasks are not treated as blockers without an explicit source signal.</span>
          </div>
        </aside>
      </section>
    </>
  );
}

function Toolbar({ label = "Search records" }: { label?: string }) {
  return (
    <div className="toolbar" aria-label="Record controls">
      <label className="search-control">
        <Search size={17} />
        <span className="sr-only">{label}</span>
        <input placeholder={label} disabled />
      </label>
      <button className="filter-button" disabled><SlidersHorizontal size={16} /> Filters <ChevronDown size={14} /></button>
      <span className="toolbar-note">Available after source verification</span>
    </div>
  );
}

function ConnectedToolbar({
  label,
  query,
  onQueryChange,
  resultLabel,
  children,
}: {
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  resultLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="toolbar" aria-label="Record controls">
      <label className="search-control">
        <Search size={17} />
        <span className="sr-only">{label}</span>
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={label} />
      </label>
      {children}
      <span className="toolbar-note">{resultLabel}</span>
    </div>
  );
}

function DataTableEmpty({
  columns,
  title,
  copy,
  setView,
}: {
  columns: string[];
  title: string;
  copy: string;
  setView: (view: ViewId) => void;
}) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            <tr>
              <td colSpan={columns.length}>
                <EmptyPanel icon={TableProperties} title={title} copy={copy} action="Review connection" onAction={() => setView("connections")} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffDirectory({ company, setView, sheetState }: { company: Company; setView: (view: ViewId) => void; sheetState: SheetState }) {
  const [query, setQuery] = useState("");
  const snapshot = sheetState.kind === "ready" ? sheetState.snapshot : null;
  const normalizedQuery = query.trim().toLowerCase();
  const scopedStaff = snapshot
    ? snapshot.staff.filter((person) => staffMatchesCompany(person, company.id))
    : [];
  const visibleStaff = scopedStaff.filter((person) =>
    [person.name, person.organization, person.role, person.department, person.email]
      .some((value) => value.toLowerCase().includes(normalizedQuery)),
  );

  return (
    <>
      <PageHeading
        eyebrow={`${company.shortName} / Verified roster`}
        title="Staff Directory"
        description="Operational staff details from the approved “Staffs Details” tab, with source evidence and explicit organization mappings."
      >
        <button className="primary-button" disabled><UsersRound size={17} /> Assign task</button>
      </PageHeading>
      {snapshot ? (
        <>
          <ConnectedToolbar
            label="Search name, role, or department"
            query={query}
            onQueryChange={setQuery}
            resultLabel={`${visibleStaff.length} of ${scopedStaff.length} staff in scope`}
          />
          <div className="table-card">
            <div className="table-scroll">
              <table>
                <thead><tr>{["Staff member", "Organization", "Role", "Department", "Work email", "Mapping", "Workplan"].map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>
                  {visibleStaff.length ? visibleStaff.map((person) => {
                    const mappings = sourceOrganizationCompanyIds(person.organization);
                    const workplanCount = snapshot.tasks.filter((task) => task.owner.toLowerCase() === person.name.toLowerCase()).length;
                    return (
                      <tr key={person.id}>
                        <td><strong>{person.name || "Not provided"}</strong><small className="table-secondary">{person.sourceSheet} · row {person.sourceRow}</small></td>
                        <td>{person.organization || "Not provided"}</td>
                        <td>{person.role || "Not provided"}</td>
                        <td>{person.department || "Not provided"}</td>
                        <td>{person.email}</td>
                        <td>{mappings.length ? mappings.map((id) => companies.find((item) => item.id === id)?.shortName).filter(Boolean).join(" + ") : <StatusPill tone="review">Needs mapping</StatusPill>}</td>
                        <td><button className="table-action" onClick={() => setView("staff-workplan")}>{workplanCount} rows <ArrowRight size={14} /></button></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={7}><EmptyPanel icon={UserRoundSearch} title="No staff match this scope" copy="The verified roster contains no records matching the active company mapping and search." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <Toolbar label="Search name, role, or department" />
          <DataTableEmpty
            columns={["Staff member", "Organization", "Role", "Department", "Work email", "Mapping", "Workplan"]}
            title={sheetState.kind === "loading" ? "Checking the verified roster" : "The roster is unavailable"}
            copy={sheetState.kind === "error" ? sheetState.message : "The local server is validating the named workbook, identity, and required tabs."}
            setView={setView}
          />
        </>
      )}
    </>
  );
}

function TaskEditorDialog({ task, onClose, onSaved }: { task: SheetSnapshot["tasks"][number]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState(effectiveTaskStatus(task));
  const [assignment, setAssignment] = useState(task.dashboardNewAssignment || "");
  const [notes, setNotes] = useState(task.dashboardNotes || "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status, newAssignment: assignment, notes }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) {
      setMessage(result.message || "The shared task update could not be saved.");
      setPending(false);
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="share-dialog task-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="share-dialog-heading"><span className="share-dialog-icon"><ClipboardCheck size={20} /></span><div><p className="eyebrow">Shared dashboard update</p><h2 id="task-editor-title">Update task</h2></div><button className="dialog-close" onClick={onClose} aria-label="Close task editor"><X size={19} /></button></div>
        <p className="share-dialog-copy"><strong>{taskAssignment(task)}</strong><br />The source Sheet row stays unchanged. This reviewed dashboard update is shared and audited.</p>
        <form onSubmit={save} className="task-editor-form">
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as NormalizedTaskStatus)}><option>Done</option><option>Pending</option><option>In Progress</option><option>Needs Review</option></select></label>
          <label>Reviewed assignment<input maxLength={500} value={assignment} onChange={(event) => setAssignment(event.target.value)} placeholder="Leave blank to keep the source assignment" /></label>
          <label>Shared notes<textarea maxLength={4000} rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add operational context for authorized teammates" /></label>
          {message ? <p className="connector-error" role="alert"><AlertCircle size={16} />{message}</p> : null}
          <div className="share-dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save shared update"}</button></div>
        </form>
      </section>
    </div>
  );
}

function StaffWorkplan({ company, setView, sheetState, viewer, onRefresh }: { company: Company; setView: (view: ViewId) => void; sheetState: SheetState; viewer: DashboardViewer | null; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingTask, setEditingTask] = useState<SheetSnapshot["tasks"][number] | null>(null);
  const snapshot = sheetState.kind === "ready" ? sheetState.snapshot : null;
  const scopedTasks = snapshot
    ? snapshot.tasks.filter((task) => taskMatchesCompany(task, snapshot.staff, company.id))
    : [];
  const metrics = snapshot
    ? taskMetrics(scopedTasks, todayInTimeZone(snapshot.source.timeZone))
    : null;
  const metricValues = metrics ? [metrics.total, metrics.completed, metrics.incomplete, metrics.needsReview] : [];
  const owners = [...new Set(scopedTasks.map((task) => task.owner))].sort((a, b) => a.localeCompare(b));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTasks = scopedTasks.filter((task) => {
    const normalizedStatus = effectiveTaskStatus(task);
    const matchesSearch = [taskAssignment(task), task.currentAssignment, task.newAssignment, task.dashboardNewAssignment || "", task.owner, task.notes, task.catNotes, task.dashboardNotes || ""]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesOwner = ownerFilter === "all" || task.owner === ownerFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "blocker" && hasExplicitBlocker(task))
      || (statusFilter === "recurring" && isExplicitlyRecurring(task))
      || normalizedStatus.toLowerCase().replace(" ", "-") === statusFilter;
    return matchesSearch && matchesOwner && matchesStatus;
  });
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(visibleTasks.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageTasks = visibleTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [query, ownerFilter, statusFilter, company.id]);

  return (
    <>
      <PageHeading
        eyebrow={`${company.shortName} / Task register`}
        title="Staff Workplan"
        description="A unified, provenance-preserving view of the nine approved workplan tabs. Unknown source states remain Needs Review."
      >
        <a className="secondary-button" href={SHEET_SOURCE_URL} target="_blank" rel="noreferrer">
          Open source <ExternalLink size={15} />
        </a>
      </PageHeading>
      <div className="metric-grid metric-grid-page">
        {metricLabels.slice(0, 4).map((label, index) => (
          <article className="metric-card" key={label}><div className="metric-top"><span>{label}</span></div><strong>{metrics ? metricValues[index] : "—"}</strong><small>{metrics ? `${scopedTasks.length} rows in scope` : "Not verified"}</small></article>
        ))}
      </div>
      {snapshot ? (
        <>
          <ConnectedToolbar label="Search assignments and notes" query={query} onQueryChange={setQuery} resultLabel={`${visibleTasks.length} of ${scopedTasks.length} rows`}>
            <label className="select-control"><span className="sr-only">Filter by owner</span><select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="all">All owners</option>{owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></label>
            <label className="select-control"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="done">Done</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="needs-review">Needs Review</option><option value="blocker">Blocker flag</option><option value="recurring">Recurring flag</option></select></label>
          </ConnectedToolbar>
          <div className="table-card">
            <div className="table-scroll">
              <table>
                <thead><tr>{["Assignment", "Owner", "Department", "Due date", "Status", "Source", "Evidence", "Action"].map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>
                  {pageTasks.length ? pageTasks.map((task) => {
                    const owner = taskOwnerStaff(task, snapshot.staff);
                    const dueDate = effectiveDueDate(task);
                    const normalizedStatus = effectiveTaskStatus(task);
                    return (
                      <tr key={task.id}>
                        <td className="assignment-cell"><strong>{taskAssignment(task)}</strong>{task.newAssignment.trim() && task.currentAssignment.trim() ? <small className="table-secondary">Current: {task.currentAssignment}</small> : null}</td>
                        <td><strong>{task.owner}</strong><small className="table-secondary">{owner?.organization || "Needs mapping"}</small></td>
                        <td>{owner?.department || "Not provided"}</td>
                        <td>{dueDate?.raw || "Not provided"}{dueDate && task.newDueDate.trim() ? <small className="table-secondary">Revised date</small> : null}</td>
                        <td><StatusPill tone={statusTone(normalizedStatus)}>{normalizedStatus}</StatusPill>{task.dashboardStatus ? <small className="source-flag">Dashboard reviewed</small> : null}{hasExplicitBlocker(task) ? <small className="source-flag source-flag-blocked">Blocker source flag</small> : null}{isExplicitlyRecurring(task) ? <small className="source-flag">Recurring source flag</small> : null}</td>
                        <td><a className="table-link" href={SHEET_SOURCE_URL} target="_blank" rel="noreferrer">{task.sourceSheet} · row {task.sourceRow} <ExternalLink size={12} /></a></td>
                        <td>{task.dashboardNotes?.trim() || task.notes.trim() || task.catNotes.trim() ? "Notes available" : "No notes provided"}</td>
                        <td>{viewer && viewer.role !== "viewer" ? <button className="table-action" onClick={() => setEditingTask(task)}>Update <ArrowRight size={14} /></button> : "Read-only"}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={8}><EmptyPanel icon={TableProperties} title="No workplan rows match" copy="Adjust the active company mapping, owner, status, or search filter." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {visibleTasks.length > pageSize ? (
              <div className="table-pagination"><span>Page {currentPage} of {pageCount}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div></div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Toolbar label="Search assignments and notes" />
          <DataTableEmpty
            columns={["Assignment", "Owner", "Department", "Due date", "Status", "Source", "Evidence", "Action"]}
            title={sheetState.kind === "loading" ? "Checking the verified workplan" : "The workplan is unavailable"}
            copy={sheetState.kind === "error" ? sheetState.message : "The local server is validating the approved workbook and all nine workplan tabs."}
            setView={setView}
          />
        </>
      )}
      {editingTask ? <TaskEditorDialog task={editingTask} onClose={() => setEditingTask(null)} onSaved={onRefresh} /> : null}
    </>
  );
}

function MessageAudit({ company, setView, messageState, sharedStatus }: { company: Company; setView: (view: ViewId) => void; messageState: MessageState; sharedStatus: SharedStatus }) {
  const checks = [
    "Exact Gmail or Otter source title",
    "Minimal evidence excerpt",
    "Explicit authorized organization",
    "Real recipient from Staffs Details",
    "Proposed task wording",
  ];
  const messageCount = messageState.kind === "ready" ? messageState.count : 0;
  const connector = sharedStatus.connector;
  const gmailHealthy = connector?.status === "Healthy";

  return (
    <>
      <PageHeading
        eyebrow={`${company.shortName} / Evidence control`}
        title="Message Audit"
        description="Validate authorized message or transcript evidence, record every error, and keep task issuance as a separate human action."
      >
        <button className="primary-button" disabled><FileCheck2 size={17} /> New audit</button>
      </PageHeading>
      <div className="two-column-page">
        <section className="info-card checklist-card">
          <div className="card-title"><span className="card-icon"><BookOpenCheck size={20} /></span><div><p className="eyebrow">Intake contract</p><h2>Evidence required before issue</h2></div></div>
          <ul className="check-list">
            {checks.map((check) => <li key={check}><span><FileCheck2 size={15} /></span>{check}</li>)}
          </ul>
          <p className="card-footnote">A saved audit does not create a task. “Issue task” remains an explicit, one-time action after validation.</p>
        </section>
        <section className="info-card">
          <div className="card-title"><span className="card-icon"><Inbox size={20} /></span><div><p className="eyebrow">Authorized relay</p><h2>Gmail / Otter readiness</h2></div></div>
          <div className="connection-summary">
            <StatusPill tone={gmailHealthy ? "healthy" : "neutral"}>{connector?.status || "Not verified"}</StatusPill>
            <dl><div><dt>Required mailbox</dt><dd>{GOOGLE_AUTHORIZED_EMAIL}</dd></div><div><dt>Connected identity</dt><dd>{connector?.identityEmail || "Not connected"}</dd></div><div><dt>Write mode</dt><dd>Read-only</dd></div><div><dt>Evidence records</dt><dd>{messageCount || "Not provided"}</dd></div></dl>
          </div>
          <button className="text-button" onClick={() => setView("connections")}>Review Gmail access <ArrowRight size={16} /></button>
        </section>
      </div>
      <section className="section-block page-section">
        <div className="section-heading"><div><p className="eyebrow">Audit register</p><h2>Authorized Gmail evidence</h2></div><StatusPill tone={gmailHealthy ? "healthy" : "neutral"}>{messageCount ? `${messageCount} messages` : "Not verified"}</StatusPill></div>
        {messageState.kind === "ready" && messageState.messages.length ? (
          <div className="table-card"><div className="table-scroll"><table>
            <thead><tr><th>Source title</th><th>Sender</th><th>Date</th><th>Evidence type</th><th>Evidence excerpt</th><th>Attachments</th><th>Source</th></tr></thead>
            <tbody>{messageState.messages.map((message) => <tr key={message.id}>
              <td className="assignment-cell"><strong>{message.source_title || "Not provided"}</strong><small className="table-secondary">Thread {message.gmail_thread_id}</small></td>
              <td>{message.sender || "Not provided"}</td>
              <td>{message.sent_at ? formatRefreshTime(message.sent_at) : "Not provided"}</td>
              <td><StatusPill tone="review">{message.evidence_kind}</StatusPill></td>
              <td className="evidence-excerpt">{message.evidence_excerpt || "No readable message or attachment text extracted"}</td>
              <td>{message.attachment_names.length ? message.attachment_names.join(", ") : "None"}</td>
              <td><a className="table-link" href={message.source_url} target="_blank" rel="noreferrer">Open Gmail <ExternalLink size={12} /></a></td>
            </tr>)}</tbody>
          </table></div></div>
        ) : (
          <EmptyPanel icon={MailCheck} title={messageState.kind === "loading" ? "Checking shared Gmail evidence" : "No authorized message snapshot"} copy={messageState.kind === "error" ? messageState.message : "Connect and refresh the exact authorized mailbox to materialize its bounded Otter evidence in the shared dashboard."} action="Open connections" onAction={() => setView("connections")} />
        )}
      </section>
    </>
  );
}

function Projects({ company, setView }: { company: Company; setView: (view: ViewId) => void }) {
  return (
    <>
      <PageHeading
        eyebrow={`${company.shortName} / Explainable grouping`}
        title="Projects"
        description="Project groups are derived only from verified task wording and evidence. Community remains source metadata, never a classification signal."
      />
      <div className="rule-strip">
        <span className="rule-icon"><Network size={20} /></span>
        <div><strong>Classification boundary</strong><p>Assignment fields carry more weight than notes. Low-confidence or conflicting evidence goes to Needs Classification.</p></div>
        <span className="scope-label">Deterministic rules</span>
      </div>
      <Toolbar label="Search projects or task evidence" />
      <EmptyPanel icon={BriefcaseBusiness} title="No verified tasks to classify" copy="Projects will be derived after the workplan or authorized message evidence completes a successful read." action="Review source access" onAction={() => setView("connections")} />
    </>
  );
}

function SibFactory({ company, setCompany, setView }: { company: Company; setCompany: (id: CompanyId) => void; setView: (view: ViewId) => void }) {
  const inScope = company.id === "all" || company.id === "shellys-bistro";

  return (
    <>
      <PageHeading
        eyebrow="Shelly's Bistro / Dedicated operations"
        title="SIB Factory"
        description="Live factory requirements from the authoritative GitHub prompt, kept distinct from verified Sheet tasks and conceptual research assignments."
      >
        <a className="secondary-button" href={SIB_FACTORY_SOURCE_URL} target="_blank" rel="noreferrer">Open authority <ExternalLink size={15} /></a>
      </PageHeading>
      {!inScope ? (
        <div className="scope-warning"><Building2 size={19} /><div><strong>Outside the active company scope</strong><p>SIB Factory belongs inside Shelly's Bistro; it is not a separate tenant.</p></div><button className="text-button" onClick={() => setCompany("shellys-bistro")}>Switch workspace <ArrowRight size={16} /></button></div>
      ) : null}
      <div className="source-banner">
        <div><span className="source-banner-icon"><Link2 size={19} /></span><div><p className="eyebrow">Bootstrap source</p><h2>Master build prompt</h2><p>Live retrieval has not completed. No fallback facts are presented as current.</p></div></div>
        <StatusPill />
      </div>
      <div className="three-column-page">
        <section className="info-card"><span className="card-icon"><Factory size={20} /></span><p className="eyebrow">Requirements</p><h2>Workstreams</h2><p>Required navigation and operating workstreams will appear after the GitHub source is read successfully.</p></section>
        <section className="info-card"><span className="card-icon"><Sparkles size={20} /></span><p className="eyebrow">Research</p><h2>Assignments R01–R12</h2><p>Conceptual research stays visibly separate from real staff workplan records.</p></section>
        <section className="info-card"><span className="card-icon"><ClipboardCheck size={20} /></span><p className="eyebrow">Sheet evidence</p><h2>Verified tasks</h2><p>Shelly's Bistro workplan tasks require an authorized Sheet snapshot.</p></section>
      </div>
      <section className="section-block page-section"><EmptyPanel icon={Factory} title="Factory source not verified" copy="The server must request the raw main-branch prompt with no-store behavior before live requirements can appear." action="Review connections" onAction={() => setView("connections")} /></section>
    </>
  );
}

function Routines({ company, setView, routineState }: { company: Company; setView: (view: ViewId) => void; routineState: RoutineState }) {
  const routineOwners = ["Christine", "Bella", "Ashley", "Trisha"];
  const [owner, setOwner] = useState("all");
  const [cadence, setCadence] = useState("all");
  const [search, setSearch] = useState("");
  const routines = routineState.kind === "ready" ? routineState.routines : [];
  const companyRoutines = routines.filter((routine) => company.id === "all" || routine.organization_ids.includes(company.id));
  const filtered = companyRoutines.filter((routine) => {
    if (owner !== "all" && routine.owner !== owner) return false;
    if (cadence !== "all" && routine.cadence !== cadence) return false;
    const query = search.trim().toLowerCase();
    return !query || [routine.task, routine.section, routine.schedule, routine.category, routine.source_status, routine.notes]
      .some((value) => value.toLowerCase().includes(query));
  });
  return (
    <>
      <PageHeading eyebrow={`${company.shortName} / Recurring evidence`} title="Routines" description="Read-only Daily, Weekly, and Monthly responsibilities from the four explicitly approved routine workbooks." />
      <div className="owner-tabs" role="tablist" aria-label="Routine owners">
        <button className={`owner-tab ${owner === "all" ? "active" : ""}`} role="tab" aria-selected={owner === "all"} onClick={() => setOwner("all")}>All approved staff</button>
        {routineOwners.map((routineOwner) => <button className={`owner-tab ${owner === routineOwner ? "active" : ""}`} role="tab" aria-selected={owner === routineOwner} onClick={() => setOwner(routineOwner)} key={routineOwner}>{routineOwner}</button>)}
      </div>
      <div className="toolbar" aria-label="Routine filters">
        <label className="search-control"><Search size={17} /><span className="sr-only">Search routine tasks</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search routine tasks" /></label>
        <label className="select-control"><span className="sr-only">Filter by cadence</span><select value={cadence} onChange={(event) => setCadence(event.target.value)}><option value="all">All cadences</option><option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option></select></label>
        <span className="toolbar-note">{filtered.length} of {companyRoutines.length} routine tasks</span>
      </div>
      <section className="section-block page-section">
        <div className="routine-sources">
          {routineOwners.map((routineOwner) => {
            const count = companyRoutines.filter((routine) => routine.owner === routineOwner).length;
            return <div key={routineOwner}><span className="source-icon"><CalendarClock size={17} /></span><span><strong>{routineOwner} Routine</strong><small>{count ? `${count} verified tasks` : "Approved workbook"}</small></span><StatusPill tone={count ? "healthy" : "neutral"}>{count ? "Loaded" : "Not verified"}</StatusPill></div>;
          })}
        </div>
        {filtered.length ? <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Owner</th><th>Cadence</th><th>Section / task</th><th>Schedule</th><th>Category</th><th>Source status</th><th>Source</th></tr></thead><tbody>{filtered.map((routine) => <tr key={routine.id}><td><strong>{routine.owner}</strong></td><td><StatusPill tone="progress">{routine.cadence}</StatusPill></td><td className="assignment-cell"><strong>{routine.task}</strong>{routine.section ? <small className="table-secondary">{routine.section}</small> : null}{routine.notes ? <small className="table-secondary">{routine.notes}</small> : null}</td><td>{routine.schedule || "Not provided"}</td><td>{routine.category || "Not provided"}</td><td>{routine.source_status || "Not provided"}</td><td><a className="table-link" href={routine.source_url} target="_blank" rel="noreferrer">{routine.sheet_name} · row {routine.source_row} <ExternalLink size={12} /></a></td></tr>)}</tbody></table></div></div> : <EmptyPanel icon={CalendarClock} title={routineState.kind === "loading" ? "Checking approved routine workbooks" : routineState.kind === "error" ? "Routine records are unavailable" : companyRoutines.length ? "No routines match these filters" : "Routine files have not been verified"} copy={routineState.kind === "error" ? routineState.message : companyRoutines.length ? "Adjust the owner, cadence, or search filters." : "Only approved Daily, Weekly, or Monthly sheets appear after a shared Google refresh."} action={companyRoutines.length ? undefined : "Review Drive access"} onAction={companyRoutines.length ? undefined : () => setView("connections")} />}
      </section>
    </>
  );
}

function Connections({ sheetState, sharedStatus, viewer, onRefresh }: { sheetState: SheetState; sharedStatus: SharedStatus; viewer: DashboardViewer | null; onRefresh: () => Promise<void> }) {
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteOrganizations, setInviteOrganizations] = useState<CompanyId[]>(["aima", "shellys-bistro"]);
  const snapshot = sheetState.kind === "ready" ? sheetState.snapshot : null;
  const connector = sharedStatus.connector;
  const sheetStatus = connector?.status || (snapshot ? "Healthy" : sheetState.kind === "loading" ? "Checking" : "Blocked");
  const sheetTone: StatusTone = ["Healthy", "Connected"].includes(sheetStatus) ? "healthy" : ["Blocked", "Account mismatch"].includes(sheetStatus) ? "blocked" : "neutral";
  const refreshTime = connector?.lastSuccessfulAt ? formatRefreshTime(connector.lastSuccessfulAt) : snapshot ? formatRefreshTime(snapshot.connector.retrievedAt) : "Not provided";
  const attemptedTime = connector?.lastAttemptedAt ? formatRefreshTime(connector.lastAttemptedAt) : "Not provided";
  const googleIdentity = connector?.identityEmail || snapshot?.connector.identity.email || "Not verified";
  const messageCount = connector?.recordCounts?.messages;
  const routineCount = connector?.recordCounts?.routines;

  async function runAction(name: string, endpoint: string, body?: Record<string, unknown>) {
    setActionPending(name);
    setActionMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json() as { message?: string; status?: string; counts?: Record<string, number> };
    setActionMessage(response.ok ? `${result.status || "Complete"}${result.counts ? ` · ${Object.entries(result.counts).map(([key, value]) => `${value} ${key}`).join(" · ")}` : ""}` : result.message || "The action could not be completed.");
    setActionPending(null);
    if (response.ok) await onRefresh();
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("invite", "/api/admin/invitations", { email: inviteEmail, role: inviteRole, organizationIds: inviteOrganizations });
    setInviteEmail("");
  }

  function toggleOrganization(id: CompanyId) {
    setInviteOrganizations((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  const rows: Array<{
    source: string;
    connector: string;
    identity: string;
    status: string;
    tone: StatusTone;
    mode: string;
    attempted: string;
    successful: string;
    records: string;
    mapping: string;
    href?: string;
  }> = [
    { source: "Staff Details and Task Sheet", connector: "Google Sheets", identity: googleIdentity, status: sheetStatus, tone: sheetTone, mode: "Read-only", attempted: attemptedTime, successful: refreshTime, records: snapshot ? `${snapshot.counts.staff} staff · ${snapshot.counts.tasks} tasks` : "Not provided", mapping: snapshot?.connector.mappingMode || "Shared database", href: SHEET_SOURCE_URL },
    { source: "Approved routine files", connector: "Google Sheets", identity: googleIdentity, status: connector?.status || "Access needed", tone: sheetTone, mode: "Read-only", attempted: attemptedTime, successful: refreshTime, records: routineCount != null ? `${routineCount} routine tasks` : "Not provided", mapping: "Four approved workbooks" },
    { source: "Authorized mailbox", connector: "Gmail", identity: googleIdentity, status: connector?.status || "Not verified", tone: sheetTone, mode: "Read-only", attempted: attemptedTime, successful: refreshTime, records: messageCount != null ? `${messageCount} bounded messages` : "Not provided", mapping: "Exact mailbox required" },
    { source: "Gmail-delivered evidence", connector: "Otter", identity: connector ? "Through shared Gmail connector" : "Through authorized Gmail", status: connector?.status || "Not verified", tone: sheetTone, mode: "Read-only", attempted: attemptedTime, successful: refreshTime, records: messageCount != null ? `${messageCount} source groups` : "Not provided", mapping: "Gmail evidence only" },
    { source: "SIB Factory master prompt", connector: "GitHub", identity: "Not verified", status: "Not verified", tone: "neutral", mode: "Read-only", attempted: "Not provided", successful: "Not provided", records: "Not provided", mapping: "Shelly's Bistro", href: SIB_FACTORY_SOURCE_URL },
  ];
  return (
    <>
      <PageHeading eyebrow="System administration / Source boundary" title="Data & Connections" description="Connected identity, verification state, safe errors, and read/write boundaries for every approved operational source." />
      <div className="notice-banner"><ShieldCheck size={20} /><div><strong>{sharedStatus.mode === "shared" ? "One shared data workspace" : "Local reference mode"}</strong><p>{sharedStatus.mode === "shared" ? `${googleIdentity} is the single server-side source identity. Every allowlisted dashboard user reads the same persisted snapshot; they do not connect Gmail separately.` : "Configure Supabase and Google OAuth to move this verified local snapshot into a persistent multi-user dashboard."}</p></div></div>
      {viewer?.role === "admin" && sharedStatus.mode === "shared" ? (
        <section className="connection-admin-panel" aria-labelledby="connector-admin-heading">
          <div className="section-heading"><div><p className="eyebrow">Administrator controls</p><h2 id="connector-admin-heading">Connect, refresh, and share access</h2></div><StatusPill tone={sheetTone}>{connector?.status || "Not connected"}</StatusPill></div>
          <div className="admin-action-grid">
            <article><span className="card-icon"><ShieldCheck size={20} /></span><h3>Google source account</h3><p>Authorize the exact mailbox once. Tokens remain encrypted on the server.</p><a className="primary-button" href="/api/google/connect">{connector ? "Reconnect Google" : "Connect Google"}<ArrowRight size={16} /></a></article>
            <article><span className="card-icon"><RefreshCw size={20} /></span><h3>Refresh shared records</h3><p>Read the canonical Sheet and bounded Gmail evidence into PostgreSQL.</p><button className="primary-button" disabled={Boolean(actionPending) || !connector} onClick={() => void runAction("sync", "/api/google/sync")}><RefreshCw size={16} />{actionPending === "sync" ? "Refreshing…" : "Refresh now"}</button>{sharedStatus.localImportAvailable ? <button className="text-button" disabled={Boolean(actionPending)} onClick={() => void runAction("import", "/api/admin/import-local-snapshot")}>Import verified local snapshot</button> : null}</article>
            <article className="invite-card"><span className="card-icon"><UserPlus size={20} /></span><h3>Invite dashboard user</h3><p>Invite a teammate to this same live dashboard and choose their scope.</p><form onSubmit={invite}><input aria-label="Invitee work email" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" /><select aria-label="Invitee role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Administrator</option></select><div className="invite-orgs">{companies.filter((item) => item.id !== "all").map((item) => <label key={item.id}><input type="checkbox" checked={inviteOrganizations.includes(item.id)} onChange={() => toggleOrganization(item.id)} />{item.shortName}</label>)}</div><button className="primary-button" disabled={Boolean(actionPending)}><Send size={16} />{actionPending === "invite" ? "Sending…" : "Send secure invite"}</button></form></article>
          </div>
          {actionMessage ? <p className="admin-action-message" role="status">{actionMessage}</p> : null}
          {connector?.safeError ? <p className="connector-error"><AlertCircle size={16} />{connector.safeError}</p> : null}
        </section>
      ) : null}
      <div className="connection-table table-card">
        <div className="table-scroll"><table><thead><tr><th>Source</th><th>Connector</th><th>Connected / expected identity</th><th>Status</th><th>Write mode</th><th>Last attempted</th><th>Last successful</th><th>Verified records</th><th>Mapping mode</th><th aria-label="Source link" /></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.source}><td><strong>{row.source}</strong></td><td>{row.connector}</td><td>{row.identity}</td><td><StatusPill tone={row.tone}>{row.status}</StatusPill></td><td>{row.mode}</td><td>{row.attempted}</td><td>{row.successful}</td><td>{row.records}</td><td>{row.mapping}</td><td>{row.href ? <a className="icon-link" href={row.href} target="_blank" rel="noreferrer" aria-label={`Open ${row.source}`}><ExternalLink size={16} /></a> : <span aria-label="No direct link">—</span>}</td></tr>)}</tbody></table></div>
      </div>
      <div className="three-column-page connection-details">
        <section className="info-card"><span className="card-icon"><ShieldCheck size={20} /></span><p className="eyebrow">Identity first</p><h2>{connector?.identityName || snapshot?.connector.identity.name || "Account verification required"}</h2><p>{connector ? `${connector.identityEmail} is the shared server-side Google identity.` : "No source content is imported until the connected identity and exact source access both verify."}</p></section>
        <section className="info-card"><span className="card-icon"><Cloud size={20} /></span><p className="eyebrow">Shared persistence</p><h2>{snapshot ? `${snapshot.counts.staff + snapshot.counts.tasks} verified rows` : "Approved sources only"}</h2><p>{sharedStatus.mode === "shared" ? "Verified source rows persist in PostgreSQL and are available to every authorized user within their organization scope." : "The current device-only snapshot must be imported after shared mode is configured."}</p></section>
        <section className="info-card"><span className="card-icon"><Blocks size={20} /></span><p className="eyebrow">External writes</p><h2>Disabled by design</h2><p>Sheet writes and email sends remain unavailable until authorization, idempotency, and audit controls exist.</p></section>
      </div>
    </>
  );
}

function AuditHistory({ company, setView, auditState }: { company: Company; setView: (view: ViewId) => void; auditState: AuditState }) {
  const events = auditState.kind === "ready" ? auditState.events.filter((event) => company.id === "all" || event.organization_ids.includes(company.id)) : [];
  return (
    <>
      <PageHeading eyebrow={`${company.shortName} / Accountability`} title="Audit History" description="Material dashboard-side actions, configuration changes, and source verification events—never manufactured system activity." />
      {events.length ? <div className="table-card"><div className="table-scroll"><table><thead><tr>{["Time", "Organization", "Actor", "Action", "Entity", "Details"].map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{formatRefreshTime(event.created_at)}</td><td>{event.organization_ids.length ? event.organization_ids.map((id) => companies.find((item) => item.id === id)?.shortName || id).join(", ") : "All / system"}</td><td>{event.actor_email}</td><td><strong>{event.action}</strong></td><td>{event.entity_type} · {event.entity_id}</td><td>{Object.keys(event.details || {}).length ? JSON.stringify(event.details) : "Not provided"}</td></tr>)}</tbody></table></div></div> : <DataTableEmpty columns={["Time", "Organization", "Actor", "Action", "Entity", "Details"]} title={auditState.kind === "loading" ? "Checking shared audit history" : "No material actions recorded"} copy={auditState.kind === "error" ? auditState.message : "Connector refreshes, invitations, and dashboard task updates will appear here."} setView={setView} />}
    </>
  );
}

export function DashboardShell({ viewer, sharedMode }: { viewer: DashboardViewer | null; sharedMode: boolean }) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyId>(viewer && viewer.role !== "admin" ? viewer.organizationIds[0] || "all" : "all");
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [sheetState, setSheetState] = useState<SheetState>({ kind: "loading" });
  const [messageState, setMessageState] = useState<MessageState>(sharedMode ? { kind: "loading" } : { kind: "ready", messages: [], count: 0 });
  const [routineState, setRoutineState] = useState<RoutineState>(sharedMode ? { kind: "loading" } : { kind: "ready", routines: [], count: 0 });
  const [sharedStatus, setSharedStatus] = useState<SharedStatus>({ mode: sharedMode ? "shared" : "local", connector: null });
  const [auditState, setAuditState] = useState<AuditState>(sharedMode ? { kind: "loading" } : { kind: "ready", events: [] });

  async function loadSharedData() {
    const requests: Promise<void>[] = [];
    requests.push((async () => {
      try {
        const response = await fetch("/api/google-sheet", { cache: "no-store" });
        const payload = await response.json() as SheetSnapshot | { message?: string };
        if (!response.ok) {
          throw new Error("message" in payload && payload.message ? payload.message : "The verified Google Sheet snapshot is unavailable.");
        }
        if (!("staff" in payload) || !("tasks" in payload)) {
          throw new Error("The verified Google Sheet response is incomplete.");
        }
        setSheetState({ kind: "ready", snapshot: payload });
      } catch (error) {
        setSheetState({ kind: "error", message: error instanceof Error ? error.message : "The verified Google Sheet snapshot is unavailable." });
      }
    })());
    requests.push((async () => {
      try {
        const response = await fetch("/api/shared-status", { cache: "no-store" });
        if (response.ok) setSharedStatus(await response.json() as SharedStatus);
      } catch {
        setSharedStatus({ mode: sharedMode ? "shared" : "local", connector: null });
      }
    })());
    if (sharedMode) requests.push((async () => {
      try {
        const response = await fetch("/api/messages", { cache: "no-store" });
        const payload = await response.json() as { messages?: MessageSummary[]; count?: number; message?: string };
        if (!response.ok) throw new Error(payload.message || "Shared Gmail evidence is unavailable.");
        setMessageState({ kind: "ready", messages: payload.messages ?? [], count: payload.count ?? 0 });
      } catch (error) {
        setMessageState({ kind: "error", message: error instanceof Error ? error.message : "Shared Gmail evidence is unavailable." });
      }
    })());
    if (sharedMode) requests.push((async () => {
      try {
        const response = await fetch("/api/routines", { cache: "no-store" });
        const payload = await response.json() as { routines?: RoutineRecord[]; count?: number; message?: string };
        if (!response.ok) throw new Error(payload.message || "Shared routine records are unavailable.");
        setRoutineState({ kind: "ready", routines: payload.routines ?? [], count: payload.count ?? 0 });
      } catch (error) {
        setRoutineState({ kind: "error", message: error instanceof Error ? error.message : "Shared routine records are unavailable." });
      }
    })());
    if (sharedMode) requests.push((async () => {
      try {
        const response = await fetch("/api/audit", { cache: "no-store" });
        const payload = await response.json() as { events?: AuditEvent[]; message?: string };
        if (!response.ok) throw new Error(payload.message || "Shared audit history is unavailable.");
        setAuditState({ kind: "ready", events: payload.events ?? [] });
      } catch (error) {
        setAuditState({ kind: "error", message: error instanceof Error ? error.message : "Shared audit history is unavailable." });
      }
    })());
    await Promise.all(requests);
  }

  useEffect(() => {
    let active = true;
    if (active) void loadSharedData();
    return () => { active = false; };
    // The data loader is intentionally run once on bootstrap and explicitly after admin refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCompanies = viewer && viewer.role !== "admin"
    ? companies.filter((item) => item.id !== "all" && viewer.organizationIds.includes(item.id))
    : companies;

  const company = useMemo(
    () => companies.find((item) => item.id === selectedCompany) ?? companies[0],
    [selectedCompany],
  );
  const activeNav = navigation.find((item) => item.id === activeView) ?? navigation[0];

  const themeStyle = {
    "--accent": company.accent,
    "--accent-strong": company.accentStrong,
    "--accent-soft": company.soft,
    "--nav-color": company.nav,
  } as CSSProperties;

  const navigate = (view: ViewId) => {
    setActiveView(view);
    setMobileNavOpen(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.querySelector<HTMLElement>("#main-content")?.focus({ preventScroll: true });
    });
  };

  const downloadSafeExport = () => {
    const payload = {
      dashboard: "Workflow Management",
      workspace: company.name,
      view: activeNav.label,
      exportedAt: new Date().toISOString(),
      privacy: {
        emailAddresses: "excluded",
        messageContent: "excluded",
        attachmentContent: "excluded",
      },
      sourceStatus: sheetState.kind === "ready" ? sharedMode ? "Shared verified snapshot" : "Verified local Google Sheet snapshot" : "Not verified",
      records: [],
    };
    const file = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workflow-dashboard-${company.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShareOpen(false);
  };

  async function copyDashboardLink() {
    await navigator.clipboard.writeText(window.location.origin);
    setShareMessage("Dashboard link copied. The recipient must still be invited and signed in.");
  }

  const renderPage = () => {
    switch (activeView) {
      case "message-audit": return <MessageAudit company={company} setView={navigate} messageState={messageState} sharedStatus={sharedStatus} />;
      case "projects": return <Projects company={company} setView={navigate} />;
      case "sib-factory": return <SibFactory company={company} setCompany={setSelectedCompany} setView={navigate} />;
      case "staff-directory": return <StaffDirectory company={company} setView={navigate} sheetState={sheetState} />;
      case "staff-workplan": return <StaffWorkplan company={company} setView={navigate} sheetState={sheetState} viewer={viewer} onRefresh={loadSharedData} />;
      case "routines": return <Routines company={company} setView={navigate} routineState={routineState} />;
      case "connections": return <Connections sheetState={sheetState} sharedStatus={sharedStatus} viewer={viewer} onRefresh={loadSharedData} />;
      case "audit-history": return <AuditHistory company={company} setView={navigate} auditState={auditState} />;
      default: return <Overview company={company} setView={navigate} sheetState={sheetState} />;
    }
  };

  return (
    <div className={`app-shell ${sidebarCompact ? "sidebar-compact" : ""}`} style={themeStyle}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`} aria-label="Primary navigation">
        <div className="brand-row">
          <span className="brand-mark">WM</span>
          <div className="brand-copy"><strong>Workflow</strong><span>Management</span></div>
          <button className="mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="sidebar-context">
          <span className="context-dot" />
          <div><small>{sharedMode ? "Shared live workspace" : "Local reference build"}</small><strong>{sheetState.kind === "ready" ? "Verified shared snapshot" : sheetState.kind === "loading" ? "Checking sources" : "Source unavailable"}</strong></div>
        </div>
        <nav className="primary-nav">
          <p className="nav-label">Workspace</p>
          {navigation.map(({ id, label, description, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => navigate(id)} aria-current={activeView === id ? "page" : undefined} title={sidebarCompact ? label : undefined}>
              <span className="nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
              <span className="nav-copy"><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="admin-card" onClick={() => navigate("connections")}>
            <span className="admin-avatar">{viewer ? viewer.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "SA"}</span><span className="admin-copy"><strong>{viewer?.displayName || "System administrator"}</strong><small>{viewer ? `${viewer.role} · shared workspace` : "Local reference build"}</small></span><Settings2 size={17} />
          </button>
          {sharedMode ? <form action="/api/auth/signout" method="post"><button className="collapse-button" type="submit"><X size={18} /><span>Sign out</span></button></form> : null}
          <button className="collapse-button" onClick={() => setSidebarCompact((value) => !value)} aria-label={sidebarCompact ? "Expand sidebar" : "Collapse sidebar"}>
            <PanelLeftClose size={18} /><span>{sidebarCompact ? "Expand" : "Collapse menu"}</span>
          </button>
        </div>
      </aside>

      {mobileNavOpen ? <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} /> : null}

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div><span>Workflow Management</span><strong>{activeNav.label}</strong></div>
          </div>
          <div className="topbar-actions">
            <StatusPill tone={sheetState.kind === "ready" ? "healthy" : sheetState.kind === "error" ? "blocked" : "neutral"}>{sheetState.kind === "ready" ? "1 source healthy" : sheetState.kind === "loading" ? "Checking source" : "Source blocked"}</StatusPill>
            <button className="share-button" onClick={() => setShareOpen(true)}><Share2 size={16} /> Share</button>
            <button className="help-button" onClick={() => navigate("connections")}><Database size={16} /> Source status</button>
          </div>
        </header>

        <section className="company-switcher" aria-label="Company workspaces">
          <div className="company-tabs" role="tablist">
            {availableCompanies.map((item) => (
              <button key={item.id} className={`company-tab ${selectedCompany === item.id ? "active" : ""}`} role="tab" aria-selected={selectedCompany === item.id} onClick={() => setSelectedCompany(item.id)}>
                <CompanyMark company={item} compact />
                <span>{item.shortName}</span>
                {selectedCompany === item.id ? <span className="selected-check"><FileCheck2 size={13} /></span> : null}
              </button>
            ))}
          </div>
        </section>

        <main id="main-content" className="main-content" tabIndex={-1}>{renderPage()}</main>
        <footer className="app-footer"><span>Workflow Management · {sharedMode ? "shared authenticated workspace" : "local verified snapshot"}</span><span>{sharedMode ? "One Google connection · shared persistent records" : "Production connectors not configured"}</span></footer>
      </div>

      {shareOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShareOpen(false)}>
          <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="share-dialog-heading">
              <span className="share-dialog-icon"><Share2 size={20} /></span>
              <div><p className="eyebrow">Shared live workspace</p><h2 id="share-title">Share this dashboard</h2></div>
              <button className="dialog-close" onClick={() => setShareOpen(false)} aria-label="Close share dialog"><X size={19} /></button>
            </div>
            <p className="share-dialog-copy">Share the deployed dashboard link with an invited teammate. They will sign in and interact with the same persistent records—not a copied ChatGPT conversation or empty template.</p>
            <div className="privacy-summary">
              <ShieldCheck size={19} />
              <div><strong>Access stays authenticated and role-scoped</strong><span>Only invited users can open live operational data. Safe file exports still exclude emails and message contents.</span></div>
            </div>
            <dl className="share-details">
              <div><dt>Workspace</dt><dd>{company.name}</dd></div>
              <div><dt>Dashboard view</dt><dd>{activeNav.label}</dd></div>
              <div><dt>Access</dt><dd>{sharedMode ? "Invite required" : "Shared mode not configured"}</dd></div>
            </dl>
            {shareMessage ? <p className="admin-action-message" role="status">{shareMessage}</p> : null}
            <div className="share-dialog-actions">
              <button className="secondary-button" onClick={downloadSafeExport}><Download size={17} /> Safe export</button>
              {sharedMode ? <button className="secondary-button" onClick={() => void copyDashboardLink()}><Share2 size={17} /> Copy live link</button> : null}
              {viewer?.role === "admin" && sharedMode ? <button className="primary-button" onClick={() => { setShareOpen(false); navigate("connections"); }}><UserPlus size={17} /> Manage team access</button> : <button className="primary-button" onClick={() => setShareOpen(false)}>Done</button>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
