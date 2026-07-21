create table model_prompt_debug_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  creation_session_id uuid references creation_sessions(id) on delete cascade,
  episode_id uuid references episodes(id) on delete cascade,
  operation text not null,
  model text not null,
  skill_version text not null default '',
  skill_prompt text not null,
  orchestration_prompt text not null,
  user_prompt text not null,
  full_system_prompt text not null,
  created_at timestamptz not null default now()
);
create index model_prompt_debug_logs_user_created_idx on model_prompt_debug_logs(user_id, created_at desc);
