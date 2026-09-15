create table public.creator_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);
create unique index creator_invitation_pending_unique
on public.creator_invitations(group_id,invitee_id) where status = 'pending';
create index creator_invitation_inbox_idx
on public.creator_invitations(invitee_id,status,created_at desc);
create index creator_invitation_group_idx
on public.creator_invitations(group_id,created_at desc);
alter table public.creator_invitations enable row level security;
revoke all on public.creator_invitations from anon,authenticated;
grant select on public.creator_invitations to authenticated;
grant select,insert,update,delete on public.creator_invitations to service_role;
create policy creator_invitations_read on public.creator_invitations
for select to authenticated using (
  invitee_id = (select auth.uid()) or public.is_group_admin(group_id)
);

-- Invitation RPCs are the only new route to creator membership. A viewer
-- cannot directly add themselves, edit an invitation, or grant platform roles.
revoke insert,update,delete on public.group_admins from anon,authenticated;

create function public.invite_creator(target uuid, invited_handle text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  invited uuid;
  result uuid;
  normalized_handle text := lower(ltrim(btrim(invited_handle),'@'));
begin
  if auth.uid() is null or not public.is_group_admin(target) then
    raise exception 'Only this group''s creators can invite another creator' using errcode='42501';
  end if;
  -- Invite and acceptance operations take the group lock first, keeping
  -- concurrent invitation checks and membership changes in the same order.
  perform 1 from public.groups where id = target for update;
  select id into invited from public.profiles where handle = normalized_handle;
  if invited is null then
    raise exception 'No account has that handle' using errcode='P0002';
  end if;
  if invited = auth.uid() then
    raise exception 'You are already a creator of this group' using errcode='22023';
  end if;
  if exists(select 1 from public.group_admins where group_id = target and profile_id = invited) then
    raise exception 'That person is already a creator' using errcode='23505';
  end if;
  insert into public.creator_invitations(group_id,inviter_id,invitee_id)
  values (target,auth.uid(),invited) returning id into result;
  return result;
end; $$;

create function public.respond_creator_invitation(invitation_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare invitation public.creator_invitations;
begin
  select * into invitation from public.creator_invitations where id = invitation_id;
  if auth.uid() is null or invitation.id is null or invitation.invitee_id <> auth.uid() then
    raise exception 'Only the invited person can respond' using errcode='42501';
  end if;
  if accept is null then
    raise exception 'Choose accept or decline' using errcode='22023';
  end if;
  perform 1 from public.groups where id = invitation.group_id for update;
  select * into invitation from public.creator_invitations where id = invitation_id for update;
  if invitation.id is null or invitation.invitee_id <> auth.uid() then
    raise exception 'Invitation is unavailable' using errcode='42501';
  end if;
  if invitation.status <> 'pending' then
    raise exception 'This invitation has already been answered' using errcode='23505';
  end if;
  if accept then
    if not exists(select 1 from public.group_admins
      where group_id = invitation.group_id and profile_id = invitation.inviter_id) then
      raise exception 'The inviter is no longer a creator of this group' using errcode='42501';
    end if;
    insert into public.group_admins(group_id,profile_id)
    values (invitation.group_id,auth.uid()) on conflict do nothing;
  end if;
  update public.creator_invitations
  set status = case when accept then 'accepted' else 'declined' end
  where id = invitation_id;
end; $$;

revoke execute on function public.invite_creator(uuid,text),public.respond_creator_invitation(uuid,boolean)
from public,anon,authenticated;
grant execute on function public.invite_creator(uuid,text),public.respond_creator_invitation(uuid,boolean)
to authenticated;
