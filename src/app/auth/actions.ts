"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import { supabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
const credentials = z.object({email:z.email(),password:z.string().min(8).max(128),display_name:z.string().trim().min(2).max(60)});
export async function authenticate(input: unknown, signup: boolean): Promise<ActionResult> {
  if(DEMO_MODE) return {ok:false,message:"Use the demo account below. No password is needed."};
  const result=credentials.safeParse(input); if(!result.success) return {ok:false,message:result.error.issues[0].message};
  try {const db=await supabase(); const {email,password,display_name}=result.data;
    const {data,error}=signup ? await db.auth.signUp({email,password,options:{data:{display_name}}}) : await db.auth.signInWithPassword({email,password});
    if(error) return {ok:false,message:signup ? "Could not create your account. Please check your details and try again." : "Email or password wasn’t recognized."};
    revalidatePath("/","layout");return {ok:true,message:signup && !data.session ? "Check your email to confirm your account, then sign in." : "Signed in. Welcome to Circles."};
  } catch { return {ok:false,message:"Authentication is unavailable. Please try again shortly."}; }
}
export async function signOut(): Promise<ActionResult> { try {if(!DEMO_MODE) {const db=await supabase();const {error}=await db.auth.signOut();if(error) throw error;}revalidatePath("/","layout");return {ok:true,message:"You’ve signed out."};} catch {return {ok:false,message:"Could not sign out. Please try again."};} }
