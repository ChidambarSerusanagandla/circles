-- BYPASSRLS does not grant table privileges. New Supabase projects require
-- explicit service-role grants for server ingestion and the development seed.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.profiles, public.groups,
  public.group_admins, public.group_memberships, public.messages,
  public.message_reactions, public.questions, public.question_answers,
  public.growth_admins, public.experiments, public.experiment_assignments,
  public.analytics_events to service_role;
create index events_visitor_time_idx on public.analytics_events(anonymous_session_id,created_at desc);
