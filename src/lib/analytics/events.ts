import { z } from "zod";
import type { AnalyticsEvent, EventName } from "../types";
import type { Assignment } from "../experiments/assignment";
export const browserEventInput=z.object({id:z.uuid(),name:z.enum(["discover_viewed","group_preview_seen","group_opened"]),groupId:z.uuid().optional()}).strict().superRefine((event,ctx)=>{if(event.name!=="discover_viewed"&&!event.groupId)ctx.addIssue({code:"custom",message:"A circle is required.",path:["groupId"]});});
export function makeEvent(assignment:Assignment,name:EventName,groupId:string|null,userId:string|null,isDemo:boolean,id=crypto.randomUUID()):AnalyticsEvent {return {id,user_id:userId,anonymous_session_id:assignment.visitorId,group_id:groupId,event_name:name,experiment_id:assignment.active?assignment.experimentId:null,experiment_variant:assignment.active?assignment.variant:null,metadata:{},created_at:new Date().toISOString(),is_demo:isDemo};}
export async function bestEffort(operation:()=>Promise<unknown>):Promise<void> {try{await operation();}catch{console.warn("Analytics delivery failed; product action remains successful.");}}
