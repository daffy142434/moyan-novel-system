alter table model_prompt_debug_logs
  drop constraint if exists model_prompt_debug_logs_creation_session_id_fkey;

alter table model_prompt_debug_logs
  add constraint model_prompt_debug_logs_creation_session_id_fkey
  foreign key (creation_session_id) references creation_sessions(id) on delete set null;
