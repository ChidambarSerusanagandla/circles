import type { AnalyticsEvent, EventName, Variant } from "../types";
import { demoGroups, uid } from "../seed-data";
export const EXPERIMENT_ID=uid(8000);
export function sampleEvents():AnalyticsEvent[] {
 const events:AnalyticsEvent[]=[];let sequence=0;
 for(const variant of ["A","B"] as Variant[])for(let i=0;i<1000;i++){
  const visitor=uid((variant==="A"?10000:20000)+i);const group=demoGroups[i%6].id;
  const emit=(event_name:EventName,minute:number)=>events.push({id:uid(100000+sequence++),user_id:null,anonymous_session_id:visitor,group_id:group,event_name,experiment_id:EXPERIMENT_ID,experiment_variant:variant,metadata:{source:"simulated-seed"},created_at:new Date(Date.UTC(2026,8,10,10,minute)).toISOString(),is_demo:true});
  emit("experiment_exposed",0);emit("group_preview_seen",1);
  if(i<(variant==="A"?326:401))emit("group_opened",2);
  if(i<(variant==="A"?112:147)){emit("group_joined",3);if(i%4===0)emit("reaction_added",4);if(i%7===0)emit("question_submitted",5);}
 }
 return events;
}
