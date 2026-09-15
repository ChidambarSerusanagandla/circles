-- The current product has no paid access or simulated paid entitlement.
-- Keep the dormant columns and constraints for a future deliberate migration.
update public.groups set access_type = 'free', monthly_price = null;
update public.group_memberships set status = 'active'
where status = 'premium_demo';

-- Joining always grants ordinary active membership, even if trusted imports
-- retain old pricing metadata. The foreign key still requires a real group.
drop policy memberships_insert_self on public.group_memberships;
create policy memberships_insert_self on public.group_memberships
for insert to authenticated with check (
  profile_id = (select auth.uid()) and status = 'active'
);

-- Current creator updates cannot activate dormant pricing fields. Existing
-- column grants also prevent clients from writing those fields directly.
alter policy groups_update_admin on public.groups
using (public.is_group_admin(id))
with check (
  public.is_group_admin(id) and access_type = 'free' and monthly_price is null
);

-- Group creation remains the existing RPC, which creates a free group and its
-- first creator atomically. No direct authenticated INSERT grant is added.
create policy groups_free_insert_guard on public.groups
as restrictive for insert to authenticated
with check (access_type = 'free' and monthly_price is null);
