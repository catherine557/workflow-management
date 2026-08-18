create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name) values
  ('audit-expert', 'Audit Expert'),
  ('yens-and-santos', 'Yens and Santos'),
  ('aima', 'Accurate Indigenous Managers and Advisors (AIMA)'),
  ('shellys-bistro', 'Shelly''s Bistro')
on conflict (id) do update set name = excluded.name;

create table if not exists public.dashboard_invites (
  email text primary key check (email = lower(email)),
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  organization_ids text[] not null default '{}',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  display_name text,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_organizations (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id text not null references public.organizations(id) on delete cascade,
  primary key (profile_id, organization_id)
);

create table if not exists public.connectors (
  provider text primary key check (provider in ('google')),
  identity_email text,
  identity_name text,
  status text not null default 'Not verified',
  refresh_token_encrypted text,
  granted_scopes text[] not null default '{}',
  last_attempted_at timestamptz,
  last_successful_at timestamptz,
  safe_error text,
  record_counts jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  counts jsonb not null default '{}'::jsonb,
  safe_error text,
  actor_id uuid references auth.users(id)
);

create table if not exists public.staff_records (
  id text primary key,
  source_sheet text not null,
  source_row integer not null check (source_row > 1),
  name text not null,
  source_organization text not null default '',
  organization_ids text[] not null default '{}',
  role text not null default '',
  department text not null default '',
  work_email text not null default '',
  source_url text not null,
  sync_run_id uuid references public.sync_runs(id),
  refreshed_at timestamptz not null,
  unique (source_sheet, source_row)
);

create table if not exists public.workplan_records (
  id text primary key,
  source_sheet text not null,
  source_row integer not null check (source_row > 1),
  owner text not null,
  organization_ids text[] not null default '{}',
  current_assignment text not null default '',
  cat_notes text not null default '',
  original_due_date text not null default '',
  new_due_date text not null default '',
  community text not null default '',
  collaborator text not null default '',
  source_status text not null default '',
  notes text not null default '',
  new_assignment text not null default '',
  source_url text not null,
  sync_run_id uuid references public.sync_runs(id),
  refreshed_at timestamptz not null,
  unique (source_sheet, source_row)
);

create table if not exists public.message_evidence (
  id text primary key,
  gmail_thread_id text not null,
  gmail_message_id text not null,
  mailbox_email text not null,
  organization_ids text[] not null default '{}',
  source_title text not null default '',
  sender text not null default '',
  recipients text not null default '',
  sent_at timestamptz,
  evidence_kind text not null default 'Gmail message',
  body_text text not null default '',
  attachment_names text[] not null default '{}',
  source_url text not null,
  sync_run_id uuid references public.sync_runs(id),
  refreshed_at timestamptz not null
);

create table if not exists public.task_overrides (
  task_id text primary key references public.workplan_records(id) on delete cascade,
  normalized_status text check (normalized_status in ('Done', 'Pending', 'In Progress', 'Needs Review')),
  new_assignment text not null default '',
  notes text not null default '',
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_ids text[] not null default '{}',
  actor_id uuid references auth.users(id),
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_records_orgs_idx on public.staff_records using gin (organization_ids);
create index if not exists workplan_records_orgs_idx on public.workplan_records using gin (organization_ids);
create index if not exists message_evidence_orgs_idx on public.message_evidence using gin (organization_ids);
create index if not exists audit_events_orgs_idx on public.audit_events using gin (organization_ids);

create or replace function public.is_dashboard_user()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and active); $$;

create or replace function public.is_dashboard_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and active and role = 'admin'); $$;

create or replace function public.is_dashboard_editor()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and active and role in ('admin', 'editor')); $$;

create or replace function public.can_access_organizations(record_orgs text[])
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_dashboard_admin() or exists (
    select 1 from public.profile_organizations
    where profile_id = (select auth.uid()) and organization_id = any(record_orgs)
  );
$$;

create or replace function public.handle_invited_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare invitation public.dashboard_invites%rowtype;
begin
  select * into invitation from public.dashboard_invites where email = lower(new.email);
  if invitation.email is not null then
    insert into public.profiles (id, email, display_name, role)
    values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', new.email), invitation.role)
    on conflict (id) do update set email = excluded.email, role = excluded.role, active = true, updated_at = now();
    insert into public.profile_organizations (profile_id, organization_id)
    select new.id, unnest(invitation.organization_ids)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited after insert or update of email on auth.users
for each row execute procedure public.handle_invited_user();

alter table public.organizations enable row level security;
alter table public.dashboard_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_organizations enable row level security;
alter table public.connectors enable row level security;
alter table public.sync_runs enable row level security;
alter table public.staff_records enable row level security;
alter table public.workplan_records enable row level security;
alter table public.message_evidence enable row level security;
alter table public.task_overrides enable row level security;
alter table public.audit_events enable row level security;

create policy "users read organizations" on public.organizations for select to authenticated using (public.is_dashboard_user());
create policy "admins manage invitations" on public.dashboard_invites for all to authenticated using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());
create policy "users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_dashboard_admin());
create policy "users read own grants" on public.profile_organizations for select to authenticated using (profile_id = (select auth.uid()) or public.is_dashboard_admin());
create policy "users read connector status" on public.connectors for select to authenticated using (public.is_dashboard_user());
create policy "users read sync status" on public.sync_runs for select to authenticated using (public.is_dashboard_user());
create policy "users read scoped staff" on public.staff_records for select to authenticated using (public.can_access_organizations(organization_ids));
create policy "users read scoped workplan" on public.workplan_records for select to authenticated using (public.can_access_organizations(organization_ids));
create policy "users read scoped messages" on public.message_evidence for select to authenticated using (public.can_access_organizations(organization_ids));
create policy "users read scoped task overrides" on public.task_overrides for select to authenticated using (exists (select 1 from public.workplan_records task where task.id = task_id and public.can_access_organizations(task.organization_ids)));
create policy "editors create scoped task overrides" on public.task_overrides for insert to authenticated with check (public.is_dashboard_editor() and updated_by = (select auth.uid()) and exists (select 1 from public.workplan_records task where task.id = task_id and public.can_access_organizations(task.organization_ids)));
create policy "editors update scoped task overrides" on public.task_overrides for update to authenticated using (public.is_dashboard_editor() and exists (select 1 from public.workplan_records task where task.id = task_id and public.can_access_organizations(task.organization_ids))) with check (public.is_dashboard_editor() and updated_by = (select auth.uid()));
create policy "users read scoped audit" on public.audit_events for select to authenticated using (public.can_access_organizations(organization_ids));
create policy "editors create scoped audit" on public.audit_events for insert to authenticated with check (public.is_dashboard_editor() and actor_id = (select auth.uid()));

revoke all on public.connectors, public.sync_runs, public.staff_records, public.workplan_records, public.message_evidence, public.task_overrides, public.audit_events from anon;
grant select on public.organizations, public.profiles, public.profile_organizations, public.connectors, public.sync_runs, public.staff_records, public.workplan_records, public.message_evidence, public.task_overrides, public.audit_events to authenticated;
grant insert, update on public.task_overrides to authenticated;
grant insert on public.audit_events to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
