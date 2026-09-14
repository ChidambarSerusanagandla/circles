-- Authenticated creator only. Substitute a group that auth.uid() administers.
select previews,opens,joins,questions,reactions,
  round(100.0*opens/nullif(previews,0),2) as preview_to_open_pct,
  round(100.0*joins/nullif(opens,0),2) as open_to_join_pct
from public.creator_metrics('00000000-0000-4000-8000-000000000100',false);

-- SQL-editor diagnostic for the database owner: daily successful joins.
-- Browser-level conversion must still use preview_funnel, not raw daily counts.
select date_trunc('day',created_at) as day,count(*) as successful_joins
from public.analytics_events
where not is_demo and event_name='group_joined'
group by 1 order by 1;
