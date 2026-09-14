import { getGroups, getUser } from "@/lib/data";
import { supabase } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/config";
import { AdminDashboard } from "@/components/admin-dashboard";
import type { CreatorMetrics } from "@/lib/analytics/metrics";
import type { Question } from "@/lib/types";
export const metadata={title:"Creator studio"};
export default async function AdminPage() {
 const [groups,user]=await Promise.all([getGroups(),getUser()]);const managed=groups.filter(g=>g.admins.some(a=>a.id===user?.id));let questions:Question[]=[];const metrics:Record<string,CreatorMetrics>={};
 if(!DEMO_MODE&&user&&managed.length){const db=await supabase();const {data,error}=await db.from("questions").select("*").in("group_id",managed.map(g=>g.id)).order("created_at").limit(100);if(error)throw new Error("Could not load the question inbox.");questions=data||[];await Promise.all(managed.map(async g=>{const {data,error}=await db.rpc("creator_metrics",{target:g.id,demo:false});if(error)throw new Error("Could not load creator metrics.");const row=data?.[0];if(row)metrics[g.id]={previews:Number(row.previews),opens:Number(row.opens),joins:Number(row.joins),questions:Number(row.questions),reactions:Number(row.reactions)};}));}
 return <AdminDashboard groups={DEMO_MODE?groups:managed} user={user} questions={questions} metrics={metrics}/>;
}
