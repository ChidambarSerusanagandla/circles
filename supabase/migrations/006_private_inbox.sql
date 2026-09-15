-- Private, one-to-one messages. Creator questions and invitations remain separate.
create table public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  participant_low uuid not null references public.profiles(id) on delete cascade,
  participant_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_distinct_participants check (participant_low < participant_high),
  unique (participant_low, participant_high)
);
create index inbox_threads_low on public.inbox_threads(participant_low, updated_at desc);
create index inbox_threads_high on public.inbox_threads(participant_high, updated_at desc);
create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.inbox_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index inbox_messages_history on public.inbox_messages(thread_id, created_at desc, id desc);
alter table public.inbox_threads enable row level security;
alter table public.inbox_messages enable row level security;
create policy inbox_threads_participants on public.inbox_threads for select to authenticated
  using (auth.uid() in (participant_low, participant_high));
create policy inbox_messages_participants on public.inbox_messages for select to authenticated
  using (exists (select 1 from public.inbox_threads t where t.id = thread_id));
create policy inbox_messages_sender on public.inbox_messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.inbox_threads t where t.id = thread_id));
grant select on public.inbox_threads, public.inbox_messages to authenticated;
grant insert (thread_id, sender_id, content) on public.inbox_messages to authenticated;
grant all on public.inbox_threads, public.inbox_messages to service_role;

create function public.start_inbox_thread(recipient_handle text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare viewer uuid := auth.uid(); recipient uuid; result uuid;
begin
  if viewer is null then raise exception 'Sign in to send a private message'; end if;
  recipient_handle := lower(regexp_replace(btrim(recipient_handle), '^@', ''));
  if recipient_handle !~ '^[a-z][a-z0-9_]{2,29}$' then raise exception 'Invalid handle'; end if;
  select id into recipient from public.profiles where handle = recipient_handle;
  if recipient is null then raise exception 'No person found with that handle'; end if;
  if recipient = viewer then raise exception 'Choose another person to message'; end if;
  insert into public.inbox_threads(participant_low, participant_high)
    values (least(viewer, recipient), greatest(viewer, recipient))
    on conflict (participant_low, participant_high) do nothing;
  select id into result from public.inbox_threads
    where participant_low = least(viewer, recipient) and participant_high = greatest(viewer, recipient);
  return result;
end;
$$;
revoke all on function public.start_inbox_thread(text) from public, anon;
grant execute on function public.start_inbox_thread(text) to authenticated;

create function public.touch_inbox_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.inbox_threads set updated_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;
revoke all on function public.touch_inbox_thread() from public, anon, authenticated;
create trigger inbox_message_activity after insert on public.inbox_messages
  for each row execute function public.touch_inbox_thread();

create function public.inbox_message_page(target uuid, before_time timestamptz default null, before_id uuid default null)
returns setof public.inbox_messages language sql stable security invoker set search_path = '' as $$
  select m.* from public.inbox_messages m where m.thread_id = target
    and (before_time is null or (m.created_at, m.id) < (before_time, before_id))
    order by m.created_at desc, m.id desc limit 51
$$;
revoke all on function public.inbox_message_page(uuid,timestamptz,uuid) from public, anon;
grant execute on function public.inbox_message_page(uuid,timestamptz,uuid) to authenticated;
