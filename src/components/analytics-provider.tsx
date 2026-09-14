"use client";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { Assignment } from "@/lib/experiments/assignment";
import type { EventName } from "@/lib/types";
import { makeEvent } from "@/lib/analytics/events";
import { DEMO_MODE } from "@/lib/config";
import { updateDemo } from "./demo-provider";
const Context=createContext<Assignment|null>(null);
export function AnalyticsProvider({assignment,children}:{assignment:Assignment;children:React.ReactNode}) {return <Context.Provider value={assignment}>{children}</Context.Provider>;}
export function useAnalytics() {
 const assignment=useContext(Context);
 return useCallback((name:EventName,groupId?:string,id=crypto.randomUUID())=>{
  if(!assignment)return;
  if(DEMO_MODE){updateDemo(state=>{if(state.events.some(e=>e.id===id))return state;const event=makeEvent(assignment,name,groupId||null,state.user?.id||null,true,id);const events=[...state.events,event];if(name==="group_preview_seen"&&assignment.active&&!events.some(e=>e.event_name==="experiment_exposed"&&e.experiment_id===assignment.experimentId&&e.anonymous_session_id===assignment.visitorId))events.push(makeEvent(assignment,"experiment_exposed",null,state.user?.id||null,true));return {...state,events:events.slice(-5000)};});return;}
  if(!["discover_viewed","group_preview_seen","group_opened"].includes(name))return;
  void fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,name,...groupId?{groupId}:{}}),keepalive:true}).catch(()=>{});
 },[assignment]);
}
export function PageEvent({name,groupId}:{name:"discover_viewed"|"group_opened";groupId?:string}) {const track=useAnalytics();const id=useRef<string>(undefined);useEffect(()=>{id.current||=crypto.randomUUID();const log=()=>{if(document.visibilityState==="visible"){track(name,groupId,id.current);document.removeEventListener("visibilitychange",log);}};log();document.addEventListener("visibilitychange",log);return()=>document.removeEventListener("visibilitychange",log);},[track,name,groupId]);return null;}
export function PreviewImpression({groupId,children}:{groupId:string;children:React.ReactNode}) {
 const ref=useRef<HTMLDivElement>(null);const id=useRef<string>(undefined);const track=useAnalytics();
 useEffect(()=>{const element=ref.current?.querySelector("[data-preview-observation]");if(!element)return;id.current||=crypto.randomUUID();let timer:ReturnType<typeof setTimeout>|undefined;let visible=false;let sent=false;
 const clear=()=>{if(timer)clearTimeout(timer);timer=undefined;};
 const schedule=()=>{clear();if(visible&&!sent&&document.visibilityState==="visible")timer=setTimeout(()=>{sent=true;track("group_preview_seen",groupId,id.current);observer.disconnect();},1000);};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>=.5;schedule();},{threshold:[0,.5]});observer.observe(element);document.addEventListener("visibilitychange",schedule);
 return()=>{clear();observer.disconnect();document.removeEventListener("visibilitychange",schedule);};
 },[groupId,track]);return <div ref={ref}>{children}</div>;
}
