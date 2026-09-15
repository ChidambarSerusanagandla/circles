-- Handles are optional so existing profiles remain valid without a migration
-- inventing identities. Lowercase storage also makes uniqueness case-insensitive.
alter table public.profiles add column handle text;
alter table public.profiles add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z][a-z0-9_]{2,29}$');
alter table public.profiles add constraint profiles_handle_unique unique(handle);
grant update(handle) on public.profiles to authenticated;
-- The existing profiles_update_self policy applies to this new column too.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, handle) values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'New reader'),60),
    nullif(lower(trim(new.raw_user_meta_data->>'handle')),'')
  );
  return new;
end; $$;

-- The old development seed gave this one fictional creator internal access.
-- Do not remove other administrators explicitly appointed by an installation.
delete from public.growth_admins g using auth.users u
where g.profile_id = u.id and u.email = 'demo01@circles.example';

-- Consumers receive the four-message default until the product team starts
-- the experiment. Historical assignments and simulated outcomes are retained.
update public.experiments set status = 'draft'
where key = 'conversation-preview-length';

create function public.set_preview_experiment_status(new_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_growth_admin() then
    raise exception 'Internal growth access required' using errcode='42501';
  end if;
  if new_status is null or new_status not in ('draft','running','completed') then
    raise exception 'Invalid experiment status' using errcode='22023';
  end if;
  update public.experiments set status = new_status
  where key = 'conversation-preview-length';
  if not found then
    raise exception 'Preview experiment not found' using errcode='P0002';
  end if;
end; $$;
revoke execute on function public.set_preview_experiment_status(text) from public,anon,authenticated;
grant execute on function public.set_preview_experiment_status(text) to authenticated;
