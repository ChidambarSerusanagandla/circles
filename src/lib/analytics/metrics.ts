import type { AnalyticsEvent, Variant } from "../types";
export interface Funnel {variant:Variant;visitors:number;opens:number;joins:number;}
export interface CreatorMetrics {previews:number;opens:number;joins:number;questions:number;reactions:number;}
export const SEVEN_DAYS=7*24*60*60*1000;
export function rate(numerator:number,denominator:number) {return denominator>0?numerator/denominator:0;}
export function percent(value:number) {return `${(value*100).toFixed(1)}%`;}
export function lift(a:Funnel,b:Funnel) {const baseline=rate(a.joins,a.visitors);const delta=rate(b.joins,b.visitors)-baseline;return {absolute:delta,relative:baseline>0?delta/baseline:null};}
function afterPreview(event:AnalyticsEvent,preview:AnalyticsEvent) {const elapsed=Date.parse(event.created_at)-Date.parse(preview.created_at);return event.anonymous_session_id===preview.anonymous_session_id&&event.group_id===preview.group_id&&event.experiment_variant===preview.experiment_variant&&event.experiment_id===preview.experiment_id&&elapsed>=0&&elapsed<=SEVEN_DAYS;}
export function funnels(events:AnalyticsEvent[],isDemo:boolean):Funnel[] {
  const eligible=events.filter(e=>e.is_demo===isDemo);const previews=eligible.filter(e=>e.event_name==="group_preview_seen");
  return (["A","B"] as Variant[]).map(variant=>{const arm=previews.filter(e=>e.experiment_variant===variant);const visitors=new Set(arm.map(e=>e.anonymous_session_id));const outcomes=(name:string)=>new Set(eligible.filter(e=>e.event_name===name&&arm.some(p=>afterPreview(e,p))).map(e=>e.anonymous_session_id)).size;return {variant,visitors:visitors.size,opens:outcomes("group_opened"),joins:outcomes("group_joined")};});
}
export function creatorMetrics(events:AnalyticsEvent[],groupId:string,isDemo:boolean):CreatorMetrics {
 const eligible=events.filter(e=>e.is_demo===isDemo&&e.group_id===groupId);const previews=eligible.filter(e=>e.event_name==="group_preview_seen");
 const opens=eligible.filter(e=>e.event_name==="group_opened"&&previews.some(p=>afterPreview(e,p)));
 const joins=eligible.filter(e=>e.event_name==="group_joined"&&previews.some(p=>afterPreview(e,p)&&opens.some(o=>afterPreview(o,p)&&o.anonymous_session_id===e.anonymous_session_id&&Date.parse(o.created_at)<=Date.parse(e.created_at))));
 return {previews:new Set(previews.map(e=>e.anonymous_session_id)).size,opens:new Set(opens.map(e=>e.anonymous_session_id)).size,joins:new Set(joins.map(e=>e.anonymous_session_id)).size,questions:eligible.filter(e=>e.event_name==="question_submitted").length,reactions:eligible.filter(e=>e.event_name==="reaction_added").length};
}
