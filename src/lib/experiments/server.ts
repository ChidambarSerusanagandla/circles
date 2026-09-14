import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEMO_MODE } from "../config";
import { analyticsDatabase } from "../supabase/admin";
import { PREVIEW_EXPERIMENT_ID, variantFor, VISITOR_COOKIE, type Assignment } from "./assignment";
export const getAssignment=cache(async():Promise<Assignment>=>{
 const visitorId=(await cookies()).get(VISITOR_COOKIE)?.value || crypto.randomUUID();
 const fallback:Assignment={visitorId,variant:variantFor(visitorId),experimentId:PREVIEW_EXPERIMENT_ID,active:true};
 if(DEMO_MODE)return fallback;
 try {
  const db=analyticsDatabase();const {data:experiment,error:expError}=await db.from("experiments").select("status").eq("id",PREVIEW_EXPERIMENT_ID).single();
  if(expError)throw expError;if(experiment.status!=="running")return {...fallback,variant:"A",active:false};
  const {error}=await db.from("experiment_assignments").upsert({experiment_id:PREVIEW_EXPERIMENT_ID,anonymous_session_id:visitorId,variant:fallback.variant},{onConflict:"experiment_id,anonymous_session_id",ignoreDuplicates:true});
  if(error)throw error;
  const {data,error:readError}=await db.from("experiment_assignments").select("variant").eq("experiment_id",PREVIEW_EXPERIMENT_ID).eq("anonymous_session_id",visitorId).single();
  if(readError)throw readError;return {...fallback,variant:data.variant==="B"?"B":"A"};
 } catch {console.warn("Experiment assignment could not be persisted; using the deterministic assignment for this browser.");return fallback;}
});
