alter table projects add column if not exists product_type text not null default 'short_novel_five_chapter';
alter table projects add column if not exists production_mode text not null default '';
alter table projects add column if not exists visual_style text not null default '';
alter table projects add column if not exists audience text not null default '';
alter table projects add column if not exists ending_type text not null default '';
alter table projects add column if not exists language text not null default 'zh-CN';
alter table projects add column if not exists episode_count integer not null default 5;
alter table projects add column if not exists lifecycle_status text not null default 'writing';
alter table projects add column if not exists construction_locked boolean not null default false;
alter table projects add column if not exists synopsis text not null default '';
alter table projects add column if not exists settings jsonb not null default '{}'::jsonb;

update projects
set product_type = creation_mode,
    lifecycle_status = case when creation_mode = 'short_novel_five_chapter' then 'writing' else lifecycle_status end
where product_type = 'short_novel_five_chapter';

create table creation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_type text not null,
  selections jsonb not null default '{}'::jsonb,
  proposal_content text not null default '',
  proposal_summary text not null default '',
  title_options jsonb not null default '[]'::jsonb,
  selected_title text not null default '',
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creation_sessions_user_idx on creation_sessions(user_id, updated_at desc);

create table project_build_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage text not null,
  status text not null default 'available',
  version integer not null default 1,
  content text not null default '',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, stage)
);

create table episodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  number integer not null,
  title text not null default '',
  outline_summary text not null default '',
  status text not null default 'locked',
  content text not null default '',
  content_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, number)
);
create index episodes_project_number_idx on episodes(project_id, number);

create table episode_annotations (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  start_offset integer not null,
  end_offset integer not null,
  quoted_text text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table review_reports (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  score integer not null,
  summary text not null default '',
  suggestions jsonb not null default '[]'::jsonb,
  dimensions jsonb not null default '{}'::jsonb,
  content_version integer not null,
  created_at timestamptz not null default now()
);
create index review_reports_episode_created_idx on review_reports(episode_id, created_at desc);

create table ai_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  creation_session_id uuid references creation_sessions(id) on delete cascade,
  episode_id uuid references episodes(id) on delete cascade,
  scope text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table membership_accounts (
  user_id uuid primary key references users(id) on delete cascade,
  plan text not null default 'free',
  credit_balance numeric(14,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  type text not null,
  amount numeric(14,4) not null,
  balance_after numeric(14,4) not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table model_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  operation text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  credits numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);
create index model_usage_user_created_idx on model_usage(user_id, created_at desc);
