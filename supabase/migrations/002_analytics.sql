create table public.growth_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.growth_admins enable row level security;
revoke all on public.growth_admins from anon,authenticated;
create function public.is_growth_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.growth_admins where profile_id = (select auth.uid()));
$$;
revoke execute on function public.is_growth_admin() from public;
grant execute on function public.is_growth_admin() to authenticated;

create table public.experiments (
  id uuid primary key,
  key text not null unique,
  name text not null,
  description text not null,
  status text not null check (status in ('draft','running','completed')),
  created_at timestamptz not null default now()
);
create table public.experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id),
  anonymous_session_id uuid not null,
  variant text not null check (variant in ('A','B')),
  assigned_at timestamptz not null default now(),
  unique(experiment_id,anonymous_session_id),
  unique(experiment_id,anonymous_session_id,variant)
);
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_id uuid not null,
  group_id uuid references public.groups(id) on delete set null,
  event_name text not null check (event_name in ('discover_viewed','group_preview_seen','group_opened','group_joined','reaction_added','question_submitted','experiment_exposed')),
  experiment_id uuid references public.experiments(id),
  experiment_variant text check(experiment_variant in ('A','B')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=2048),
  is_demo boolean not null default false,
  dedupe_key text not null unique check (char_length(dedupe_key)<=200),
  created_at timestamptz not null default now(),
  check ((experiment_id is null and experiment_variant is null) or (experiment_id is not null and experiment_variant is not null)),
  foreign key(experiment_id,anonymous_session_id,experiment_variant) references public.experiment_assignments(experiment_id,anonymous_session_id,variant)
);
create index events_visitor_funnel_idx on public.analytics_events(is_demo,experiment_id,anonymous_session_id,group_id,event_name,created_at);
create index events_group_time_idx on public.analytics_events(group_id,is_demo,event_name,created_at);
alter table public.experiments enable row level security;
alter table public.experiment_assignments enable row level security;
alter table public.analytics_events enable row level security;
revoke all on public.experiments,public.experiment_assignments,public.analytics_events from anon,authenticated;
grant select on public.experiments,public.analytics_events to authenticated;
create policy experiment_internal_read on public.experiments for select to authenticated using(public.is_growth_admin());
create policy events_internal_read on public.analytics_events for select to authenticated using(public.is_growth_admin());
-- Only the trusted server (service role) assigns visitors or ingests events.
insert into public.experiments(id,key,name,description,status) values (
 '00000000-0000-4000-8000-000000008000','conversation-preview-length','Conversation Preview Length',
 'Does more context before opening a circle increase preview-to-join conversion?','running'
);

create function public.creator_metrics(target uuid, demo boolean default false)
returns table(previews bigint,opens bigint,joins bigint,questions bigint,reactions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_group_admin(target) then raise exception 'Creator access required' using errcode='42501'; end if;
 return query
 with previews as (
   select anonymous_session_id,created_at from public.analytics_events
   where group_id=target and is_demo=demo and event_name='group_preview_seen'
 ), opened as (
   select distinct o.anonymous_session_id,o.created_at from public.analytics_events o
   where o.group_id=target and o.is_demo=demo and o.event_name='group_opened'
   and exists(select 1 from previews p where p.anonymous_session_id=o.anonymous_session_id and o.created_at between p.created_at and p.created_at+interval '7 days')
 ), joined as (
   select distinct j.anonymous_session_id from public.analytics_events j
   where j.group_id=target and j.is_demo=demo and j.event_name='group_joined'
   and exists(select 1 from previews p join opened o on p.anonymous_session_id=o.anonymous_session_id
     where j.anonymous_session_id=p.anonymous_session_id and o.created_at>=p.created_at and j.created_at>=o.created_at and j.created_at<=p.created_at+interval '7 days')
 )
 select (select count(distinct anonymous_session_id) from previews),
 (select count(distinct anonymous_session_id) from opened),(select count(*) from joined),
 (select count(*) from public.analytics_events where group_id=target and is_demo=demo and event_name='question_submitted'),
 (select count(*) from public.analytics_events where group_id=target and is_demo=demo and event_name='reaction_added');
end; $$;

create function public.preview_funnel(demo boolean default false)
returns table(variant text,visitors bigint,opens bigint,joins bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_growth_admin() then raise exception 'Internal growth access required' using errcode='42501'; end if;
 return query
 with previews as (
  select anonymous_session_id,group_id,experiment_variant,created_at
  from public.analytics_events where is_demo=demo and event_name='group_preview_seen'
  and experiment_id='00000000-0000-4000-8000-000000008000'
 ), visitors as (
  select distinct anonymous_session_id,experiment_variant from previews
 ), outcomes as (
  select v.anonymous_session_id,v.experiment_variant,
   exists(select 1 from previews p join public.analytics_events e
    on e.anonymous_session_id=p.anonymous_session_id and e.group_id=p.group_id and e.experiment_variant=p.experiment_variant
    and e.experiment_id='00000000-0000-4000-8000-000000008000'
    and e.is_demo=demo and e.event_name='group_opened' and e.created_at between p.created_at and p.created_at+interval '7 days'
    where p.anonymous_session_id=v.anonymous_session_id) as opened,
   exists(select 1 from previews p join public.analytics_events e
    on e.anonymous_session_id=p.anonymous_session_id and e.group_id=p.group_id and e.experiment_variant=p.experiment_variant
    and e.experiment_id='00000000-0000-4000-8000-000000008000'
    and e.is_demo=demo and e.event_name='group_joined' and e.created_at between p.created_at and p.created_at+interval '7 days'
    where p.anonymous_session_id=v.anonymous_session_id) as joined
  from visitors v
 ) select variants.v,count(o.anonymous_session_id),count(*) filter(where o.opened),count(*) filter(where o.joined)
 from (values('A'::text),('B'::text)) variants(v) left join outcomes o on o.experiment_variant=variants.v group by variants.v order by variants.v;
end; $$;
revoke execute on function public.creator_metrics(uuid,boolean),public.preview_funnel(boolean) from public,anon,authenticated;
grant execute on function public.creator_metrics(uuid,boolean),public.preview_funnel(boolean) to authenticated;

-- Bounded batch of the first eight messages, preserving a common sequence for both arms.
create function public.preview_messages(group_ids uuid[]) returns setof public.messages
language sql stable security invoker set search_path = '' as $$
 select m.* from unnest(group_ids[1:60]) as g(id)
 cross join lateral (select * from public.messages where group_id=g.id order by created_at,id limit 8) m;
$$;
revoke execute on function public.preview_messages(uuid[]) from public;
grant execute on function public.preview_messages(uuid[]) to anon,authenticated;
