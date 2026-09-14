-- Circles: application schema. Apply in a fresh Supabase project.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 60),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  description text not null check (char_length(trim(description)) between 10 and 240),
  category text not null check (category in ('Roommates','Friendship','Comedy','Relationships','Career','Travel')),
  access_type text not null default 'free' check (access_type in ('free','premium')),
  monthly_price numeric(8,2),
  created_by uuid not null references public.profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check ((access_type = 'free' and monthly_price is null) or (access_type = 'premium' and monthly_price is not null and monthly_price > 0))
);
create table public.group_admins (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, profile_id)
);
create index group_admins_profile_idx on public.group_admins(profile_id, group_id);
create table public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('active','premium_demo')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index memberships_profile_idx on public.group_memberships(profile_id, joined_at desc);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_group_time_idx on public.messages(group_id, created_at, id);
create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('❤️','😂','😮','😢','👏','👀')),
  created_at timestamptz not null default now(),
  unique (message_id, profile_id, reaction)
);
create index reactions_profile_idx on public.message_reactions(profile_id, message_id);
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null check (char_length(trim(content)) between 5 and 500),
  status text not null default 'pending' check (status in ('pending','answered','skipped')),
  created_at timestamptz not null default now()
);
create index questions_queue_idx on public.questions(group_id,status,created_at);
create index questions_author_idx on public.questions(author_id);
create table public.question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions(id) on delete cascade,
  admin_id uuid not null references public.profiles(id),
  content text not null check (char_length(trim(content)) between 1 and 1400),
  created_at timestamptz not null default now()
);

create function public.is_group_admin(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_admins where group_id = target and profile_id = (select auth.uid()));
$$;
create function public.is_group_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_memberships where group_id = target and profile_id = (select auth.uid()));
$$;
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values (
    new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'New reader'),60)
  );
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_admins enable row level security;
alter table public.group_memberships enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;

-- Column grants are deliberate: owning a row does not permit changing identity.
revoke all on public.profiles, public.groups, public.group_admins, public.group_memberships,
  public.messages, public.message_reactions, public.questions, public.question_answers from anon, authenticated;
grant select on public.profiles, public.groups, public.group_admins, public.messages, public.questions, public.question_answers to anon, authenticated;
grant update(display_name,avatar_url) on public.profiles to authenticated;
grant update(name,description,category) on public.groups to authenticated;
grant select on public.group_memberships, public.message_reactions to authenticated;
grant insert(group_id,profile_id,status) on public.group_memberships to authenticated;
grant insert(group_id,author_id,content) on public.messages to authenticated;
grant insert(message_id,profile_id,reaction) on public.message_reactions to authenticated;
grant delete on public.message_reactions to authenticated;
grant insert(group_id,author_id,content) on public.questions to authenticated;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy groups_read on public.groups for select using (true);
create policy groups_update_admin on public.groups for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy admins_read on public.group_admins for select using (true);
create policy memberships_read_self on public.group_memberships for select to authenticated using (profile_id = (select auth.uid()));
create policy memberships_insert_self on public.group_memberships for insert to authenticated with check (
  profile_id = (select auth.uid()) and exists(select 1 from public.groups g where g.id = group_id and ((g.access_type = 'free' and status = 'active') or (g.access_type = 'premium' and status = 'premium_demo')))
);
create policy messages_read on public.messages for select using (true);
create policy messages_insert_admin on public.messages for insert to authenticated with check (author_id = (select auth.uid()) and public.is_group_admin(group_id));
create policy reactions_read_self on public.message_reactions for select to authenticated using (profile_id = (select auth.uid()));
create policy reactions_insert_self on public.message_reactions for insert to authenticated with check (profile_id = (select auth.uid()));
create policy reactions_delete_self on public.message_reactions for delete to authenticated using (profile_id = (select auth.uid()));
create policy questions_read on public.questions for select using (status = 'answered' or author_id = (select auth.uid()) or public.is_group_admin(group_id));
create policy questions_insert_member on public.questions for insert to authenticated with check (author_id = (select auth.uid()) and status = 'pending' and public.is_group_member(group_id));
create policy answers_read on public.question_answers for select using (true);

-- These functions expose counts only, never the private list of members/reactors.
create function public.group_counts() returns table(group_id uuid, member_count bigint)
language sql stable security definer set search_path = '' as $$
  select g.id, count(m.profile_id) from public.groups g left join public.group_memberships m on m.group_id = g.id group by g.id;
$$;
create function public.reaction_counts(message_ids uuid[]) returns table(message_id uuid, reaction text, total bigint)
language sql stable security definer set search_path = '' as $$
  select r.message_id, r.reaction, count(*) from public.message_reactions r where r.message_id = any(message_ids[1:500]) group by r.message_id,r.reaction;
$$;

create function public.create_group(group_name text, group_slug text, group_description text, group_category text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.groups(name,slug,description,category,created_by) values (trim(group_name),group_slug,trim(group_description),group_category,auth.uid()) returning id into result;
  insert into public.group_admins(group_id,profile_id) values (result,auth.uid());
  return result;
end; $$;
create function public.answer_question(target uuid, answer text) returns void
language plpgsql security definer set search_path = '' as $$
declare q public.questions;
begin
  select * into q from public.questions where id = target for update;
  if q.id is null or not public.is_group_admin(q.group_id) then raise exception 'Only this group’s admins can answer' using errcode='42501'; end if;
  if q.status <> 'pending' then raise exception 'This question has already been reviewed' using errcode='23505'; end if;
  insert into public.question_answers(question_id,admin_id,content) values (q.id,auth.uid(),trim(answer));
  insert into public.messages(group_id,author_id,content) values (q.group_id,auth.uid(),'A reader asked: ' || q.content || E'\n\n' || trim(answer));
  update public.questions set status = 'answered' where id = target;
end; $$;
create function public.skip_question(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare q public.questions;
begin
  select * into q from public.questions where id = target for update;
  if q.id is null or not public.is_group_admin(q.group_id) then raise exception 'Only this group’s admins can review' using errcode='42501'; end if;
  if q.status <> 'pending' then raise exception 'This question has already been reviewed' using errcode='23505'; end if;
  update public.questions set status = 'skipped' where id = target;
end; $$;
revoke execute on function public.handle_new_user(),public.create_group(text,text,text,text),public.answer_question(uuid,text),public.skip_question(uuid) from public,anon,authenticated;
grant execute on function public.create_group(text,text,text,text),public.answer_question(uuid,text),public.skip_question(uuid) to authenticated;
revoke execute on function public.is_group_admin(uuid),public.is_group_member(uuid),public.group_counts(),public.reaction_counts(uuid[]) from public;
grant execute on function public.is_group_admin(uuid),public.is_group_member(uuid),public.group_counts(),public.reaction_counts(uuid[]) to anon,authenticated;
