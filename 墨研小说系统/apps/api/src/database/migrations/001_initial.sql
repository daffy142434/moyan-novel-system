create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_unique on users (lower(email));

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  genre text not null,
  core_idea text not null,
  core_conflict text not null,
  tone text not null,
  creation_mode text not null default 'short_novel_five_chapter',
  current_step text not null default 'outline',
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_updated_idx on projects (user_id, updated_at desc);

create table project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  step_key text not null,
  position integer not null,
  status text not null check (status in ('not_started', 'available', 'editing', 'generating', 'awaiting_confirmation', 'completed', 'needs_review', 'failed', 'interrupted')),
  confirmed_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, step_key)
);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null,
  logical_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, logical_key)
);

create table generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  step_key text not null,
  status text not null check (status in ('queued', 'preparing', 'streaming', 'validating', 'repairing', 'completed', 'failed', 'cancelled', 'interrupted')),
  model text,
  skill_version text,
  prompt_snapshot text,
  request_envelope jsonb,
  normalized_response jsonb,
  partial_content text not null default '',
  candidate_version_id uuid,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  error_message text,
  idempotency_key text not null,
  cancel_requested boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (user_id, idempotency_key)
);
create index generation_runs_project_created_idx on generation_runs (project_id, created_at desc);

create table artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'candidate', 'confirmed', 'archived', 'rejected')),
  content text not null,
  structured_data jsonb not null default '{}'::jsonb,
  source_run_id uuid references generation_runs(id) on delete set null,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (artifact_id, version)
);

alter table project_steps
  add constraint project_steps_confirmed_version_fk
  foreign key (confirmed_version_id) references artifact_versions(id) on delete set null;

alter table generation_runs
  add constraint generation_runs_candidate_version_fk
  foreign key (candidate_version_id) references artifact_versions(id) on delete set null;

create table prompt_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  step_key text not null,
  content text not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, step_key)
);

