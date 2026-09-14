import "server-only";
import { DEMO_MODE } from "../config";
import { getAssignment } from "../experiments/server";
import { analyticsDatabase } from "../supabase/admin";
import type { EventName } from "../types";
import { bestEffort, makeEvent } from "./events";
export async function trackServerEvent(name:EventName,groupId:string|null,userId:string|null,key:string,occurredAt=new Date().toISOString()) {
 if(DEMO_MODE)return;
 await bestEffort(async()=>{
  const assignment=await getAssignment();const db=analyticsDatabase();
  const event=makeEvent(assignment,name,groupId,userId,false,crypto.randomUUID(),occurredAt);
  const {error}=await db.from("analytics_events").upsert({...event,metadata:{source:"application"},dedupe_key:`${name}:${key}`},{onConflict:"dedupe_key",ignoreDuplicates:true});
  if(error)throw error;
  if(name==="group_preview_seen"&&assignment.active){const {error:exposureError}=await db.from("analytics_events").upsert({...makeEvent(assignment,"experiment_exposed",null,userId,false),metadata:{source:"application"},dedupe_key:`exposure:${assignment.experimentId}:${assignment.visitorId}`},{onConflict:"dedupe_key",ignoreDuplicates:true});if(exposureError)throw exposureError;}
 });
}

