import Link from "next/link";
import { ExperimentDashboard } from "@/components/experiment-dashboard";
import { DEMO_MODE } from "@/lib/config";
import { getUser } from "@/lib/data";
import { getAssignment } from "@/lib/experiments/server";
import { supabase } from "@/lib/supabase/server";
import type { Funnel } from "@/lib/analytics/metrics";
export const metadata = { title: "Growth experiments" };
export default async function ExperimentsPage() {
  let measured: Funnel[] = [{variant:"A",visitors:0,opens:0,joins:0},{variant:"B",visitors:0,opens:0,joins:0}];
  if (!DEMO_MODE) {
    const user = await getUser();
    if (!user) return <div className="page empty"><h1>Growth experiments</h1><p>Sign in with an internal growth account to view this report.</p><Link className="button primary" href="/profile?next=/experiments">Sign in</Link></div>;
    const db = await supabase();
    const {data: allowed,error: accessError} = await db.rpc("is_growth_admin");
    if (accessError) throw new Error("Could not check access to experiments.");
    if (!allowed) return <div className="page empty"><h1>Internal access required.</h1><p>This report is available to the internal growth team. Your own circle’s metrics are in Creator studio.</p><Link className="button" href="/admin">Open Creator studio</Link></div>;
    const {data,error} = await db.rpc("preview_funnel",{demo:false});
    if (error) throw new Error("Could not load experiment results.");
    measured = (data || []).map(row => ({variant:row.variant as "A"|"B",visitors:Number(row.visitors),opens:Number(row.opens),joins:Number(row.joins)}));
  }
  return <ExperimentDashboard measured={measured} variant={(await getAssignment()).variant}/>;
}
