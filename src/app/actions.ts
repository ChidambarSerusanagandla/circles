"use server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { DEMO_MODE } from "@/lib/config";
import { answerInput, groupInput, membershipStatus, messageInput, questionInput, reactionInput, requireIdentity, uuidInput } from "@/lib/rules";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import { trackServerEvent } from "@/lib/analytics/server";
async function context() { if (DEMO_MODE) throw new Error("Use the browser demo controls in demo mode."); const user=await getUser(); requireIdentity(user?.id || null); return {db:await supabase(),user:user!}; }
function failure(error: unknown): ActionResult {return {ok:false,message:error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : "Something went wrong. Please try again."};}
export async function joinGroup(groupId: string): Promise<ActionResult> {
  try { uuidInput.parse(groupId); const {db,user}=await context();
    const {data:group,error:readError}=await db.from("groups").select("access_type").eq("id",groupId).single();
    if (readError || !group) return {ok:false,message:"This circle could not be found."};
    const {error}=await db.from("group_memberships").insert({group_id:groupId,profile_id:user.id,status:membershipStatus(group.access_type as "free"|"premium")});
    if(error?.code === "23505") return {ok:true,message:"You’re already a member."};
    if(error) return {ok:false,message:"Could not join. Please try again."};
    await trackServerEvent("group_joined",groupId,user.id,`${user.id}:${groupId}`);
    revalidatePath("/", "layout"); return {ok:true,message:group.access_type === "premium" ? "You joined the premium demo. No payment was taken." : "You’re in. Make yourself at home."};
  } catch(error) {return failure(error);}
}
export async function reactToMessage(messageId: string, reaction: string, remove: boolean): Promise<ActionResult> {
  try { uuidInput.parse(messageId); reactionInput.parse(reaction); const {db,user}=await context();
    const {error}=remove ? await db.from("message_reactions").delete().eq("message_id",messageId).eq("profile_id",user.id).eq("reaction",reaction) : await db.from("message_reactions").insert({message_id:messageId,profile_id:user.id,reaction});
    if(error && error.code !== "23505") return {ok:false,message:"Could not save your reaction."};
    if(!remove&&!error){const {data:message}=await db.from("messages").select("group_id").eq("id",messageId).single();if(message)await trackServerEvent("reaction_added",message.group_id,user.id,crypto.randomUUID());}
    revalidatePath("/groups", "layout"); return {ok:true,message:remove ? "Reaction removed." : "Reaction added."};
  } catch(error) {return failure(error);}
}
export async function submitQuestion(groupId: string, content: string): Promise<ActionResult> {
  try { uuidInput.parse(groupId); content=questionInput.parse(content); const {db,user}=await context();
    const {data:question,error}=await db.from("questions").insert({group_id:groupId,author_id:user.id,content}).select("id").single();
    if(error) return {ok:false,message:"Could not send your question. Join this circle first, then try again."};
    await trackServerEvent("question_submitted",groupId,user.id,question.id);
    revalidatePath("/", "layout"); return {ok:true,message:"Question sent. A creator can answer it in the conversation."};
  } catch(error) {return failure(error);}
}
export async function postMessage(groupId: string, content: string): Promise<ActionResult> {
  try { uuidInput.parse(groupId); content=messageInput.parse(content); const {db,user}=await context();
    const {error}=await db.from("messages").insert({group_id:groupId,author_id:user.id,content});
    if(error) return {ok:false,message:"Could not post. Only this circle’s creators can publish messages."};
    revalidatePath("/", "layout"); return {ok:true,message:"Message published."};
  } catch(error) {return failure(error);}
}
export async function moderateQuestion(questionId: string, answer: string | null): Promise<ActionResult> {
  try {uuidInput.parse(questionId);const {db}=await context();
    const {error}=answer === null ? await db.rpc("skip_question",{target:questionId}) : await db.rpc("answer_question",{target:questionId,answer:answerInput.parse(answer)});
    if(error) return {ok:false,message:error.code === "23505" ? "This question has already been reviewed." : "Could not review this question. Check your creator access."};
    revalidatePath("/", "layout"); return {ok:true,message:answer===null ? "Question skipped." : "Answer published in the conversation."};
  } catch(error) {return failure(error);}
}
export async function createGroup(input: unknown): Promise<ActionResult> {
  try {const fields=groupInput.parse(input);const {db}=await context(); const {error}=await db.rpc("create_group",{group_name:fields.name,group_slug:fields.slug,group_description:fields.description,group_category:fields.category});
    if(error) return {ok:false,message:error.code === "23505" ? "That circle address is already taken." : "Could not create this circle."};
    revalidatePath("/", "layout");return {ok:true,message:"Circle created. You can publish its first message."};
  } catch(error) {return failure(error);}
}
