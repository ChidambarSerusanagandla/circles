import "server-only";
import { cache } from "react";
import { DEMO_MODE } from "./config";
import { supabase } from "./supabase/server";
import { demoGroups } from "./seed-data";
import type { Group, Message, Profile, Question, Reaction } from "./types";
export const getUser = cache(async () => {
  if (DEMO_MODE) return null;
  const db = await supabase(); const {data:{user},error} = await db.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw new Error("Unable to verify your session. Please try again.");
  return user ? {id:user.id,display_name:String(user.user_metadata.display_name || "Reader")} : null;
});
export const getGroups = cache(async (): Promise<Group[]> => {
  if (DEMO_MODE) return demoGroups;
  const db = await supabase();
  const [groups,admins,people,counts] = await Promise.all([
    db.from("groups").select("*").order("created_at").limit(60), db.from("group_admins").select("*"),
    db.from("profiles").select("id,display_name"), db.rpc("group_counts")
  ]);
  for (const result of [groups,admins,people,counts]) if (result.error) throw new Error("Could not load circles. Check the database connection and migrations.");
  const profiles = new Map((people.data || []).map(p=>[p.id,p]));
  return Promise.all((groups.data || []).map(async g => ({...g, category:g.category as Group["category"],access_type:g.access_type as Group["access_type"],admins:(admins.data || []).filter(a=>a.group_id===g.id).map(a=>profiles.get(a.profile_id)!).filter(Boolean),member_count:Number(counts.data?.find(c=>c.group_id===g.id)?.member_count || 0),messages:await getMessages(g.id,8,0,profiles)})));
});
export async function getMessages(groupId: string, limit=50, offset=0, knownProfiles?: Map<string,Profile>): Promise<Message[]> {
  if (DEMO_MODE) return demoGroups.find(g=>g.id===groupId)?.messages.slice(offset,offset+limit) || [];
  const db = await supabase();
  const {data,error} = await db.from("messages").select("*").eq("group_id",groupId).order("created_at").order("id").range(offset,offset+limit-1);
  if (error) throw new Error("Could not load the conversation.");
  const ids=(data || []).map(m=>m.id);
  const [people,reactions] = await Promise.all([knownProfiles ? Promise.resolve({data:[...knownProfiles.values()],error:null}) : db.from("profiles").select("id,display_name").in("id",[...new Set((data || []).map(m=>m.author_id))]), db.rpc("reaction_counts",{message_ids:ids})]);
  if (people.error || reactions.error) throw new Error("Could not load conversation details.");
  const profiles = new Map((people.data || []).map(p=>[p.id,p]));
  return (data || []).map(m=>({...m,author:profiles.get(m.author_id) || {id:m.author_id,display_name:"Creator"},reactions:Object.fromEntries((reactions.data || []).filter(r=>r.message_id===m.id).map(r=>[r.reaction,Number(r.total)])) as Partial<Record<Reaction,number>>}));
}
export const getGroup = cache(async (slug: string):Promise<Group|undefined> => {
  if(DEMO_MODE)return demoGroups.find(g=>g.slug===slug);
  const db=await supabase();const {data:group,error}=await db.from("groups").select("*").eq("slug",slug).maybeSingle();
  if(error)throw new Error("Could not load this circle.");if(!group)return undefined;
  const [admins,counts]=await Promise.all([db.from("group_admins").select("profile_id").eq("group_id",group.id),db.rpc("group_counts")]);
  if(admins.error||counts.error)throw new Error("Could not load this circle’s creators.");
  const {data:people,error:peopleError}=await db.from("profiles").select("id,display_name").in("id",(admins.data||[]).map(a=>a.profile_id));
  if(peopleError)throw new Error("Could not load this circle’s creators.");
  return {...group,category:group.category as Group["category"],access_type:group.access_type as Group["access_type"],admins:people||[],member_count:Number(counts.data?.find(c=>c.group_id===group.id)?.member_count||0),messages:[]};
});
export async function getParticipation(groupId?: string) {
  const user=await getUser();
  if (!user || DEMO_MODE) return {user, memberships:[] as string[], reactions:[] as {message_id:string;reaction:string}[], questions:[] as Question[]};
  const db=await supabase();
  const [memberships,reactions,questions] = await Promise.all([
    db.from("group_memberships").select("group_id").eq("profile_id",user.id),
    db.from("message_reactions").select("message_id,reaction").eq("profile_id",user.id),
    groupId ? db.from("questions").select("*").eq("group_id",groupId).order("created_at",{ascending:false}).limit(100) : Promise.resolve({data:[],error:null})
  ]);
  for (const result of [memberships,reactions,questions]) if (result.error) throw new Error("Could not load your activity.");
  return {user,memberships:(memberships.data || []).map(m=>m.group_id),reactions:reactions.data || [],questions:questions.data || []};
}
