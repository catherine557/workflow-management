alter table public.message_evidence
  add column if not exists attachment_text text not null default '';

create table if not exists public.routine_records (
  id text primary key,
  workbook_id text not null,
  workbook_name text not null,
  sheet_name text not null,
  source_row integer not null check (source_row > 0),
  owner text not null,
  cadence text not null check (cadence in ('Daily', 'Weekly', 'Monthly')),
  section text not null default '',
  task text not null,
  schedule text not null default '',
  category text not null default '',
  source_status text not null default '',
  notes text not null default '',
  organization_ids text[] not null default '{}',
  source_url text not null,
  sync_run_id uuid references public.sync_runs(id),
  refreshed_at timestamptz not null,
  unique (workbook_id, sheet_name, source_row)
);

create index if not exists routine_records_orgs_idx
  on public.routine_records using gin (organization_ids);

alter table public.routine_records enable row level security;

create policy "users read scoped routines"
  on public.routine_records for select to authenticated
  using (public.can_access_organizations(organization_ids));

revoke all on public.routine_records from anon;
grant select on public.routine_records to authenticated;
grant select, insert, update, delete on public.routine_records to service_role;
