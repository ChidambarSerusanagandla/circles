-- Run as an authenticated growth admin via RPC, or with that auth.uid() set
-- in a trusted SQL session. false excludes simulated history.
with funnel as (
  select * from public.preview_funnel(false)
), rates as (
  select *, opens::numeric / nullif(visitors,0) as preview_to_open,
    joins::numeric / nullif(visitors,0) as preview_to_join
  from funnel
)
select variant, visitors, opens, joins,
  round(100*preview_to_open,2) as preview_to_open_pct,
  round(100*preview_to_join,2) as preview_to_join_pct,
  case when variant='B' then round(100*(preview_to_join-lag(preview_to_join) over(order by variant)),2) end as absolute_lift_pp,
  case when variant='B' then round(100*(preview_to_join/nullif(lag(preview_to_join) over(order by variant),0)-1),2) end as relative_lift_pct
from rates order by variant;

-- Enrollment allocation is not the same as qualified preview exposure.
-- Restricted to service role/internal SQL tooling, not exposed to readers.
select variant,count(*) as assigned_browsers
from public.experiment_assignments
where experiment_id='00000000-0000-4000-8000-000000008000'
  and anonymous_session_id not in (
    select anonymous_session_id from public.analytics_events where is_demo
  )
group by variant;
