import { notFound } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
import { ExperimentDashboard } from "@/components/experiment-dashboard";
import { ExperimentControls } from "@/components/experiment-controls";
import { DEMO_MODE } from "@/lib/config";
import { demoExperimentStatus } from "@/lib/auth/demo-server";
import { supabase } from "@/lib/supabase/server";
import { getAssignment } from "@/lib/experiments/server";
import type { Funnel } from "@/lib/analytics/metrics";
export const metadata = { title: "Internal Growth" };
export default async function GrowthPage() {
  const { internal } = await getAccess();
  if (!internal) notFound();
  let measured: Funnel[] = [
    { variant: "A", visitors: 0, opens: 0, joins: 0 },
    { variant: "B", visitors: 0, opens: 0, joins: 0 },
  ];
  let status = await demoExperimentStatus();
  if (!DEMO_MODE) {
    const db = await supabase();
    const [{ data, error }, { data: experiment, error: configError }] =
      await Promise.all([
        db.rpc("preview_funnel", { demo: false }),
        db
          .from("experiments")
          .select("status")
          .eq("key", "conversation-preview-length")
          .single(),
      ]);
    if (error || configError)
      throw new Error("Could not load the internal report.");
    measured = (data || []).map((r) => ({
      variant: r.variant as "A" | "B",
      visitors: Number(r.visitors),
      opens: Number(r.opens),
      joins: Number(r.joins),
    }));
    status = experiment.status as typeof status;
  }
  return (
    <>
      <ExperimentControls status={status} isDemo={DEMO_MODE} />
      <ExperimentDashboard
        measured={measured}
        variant={(await getAssignment()).variant}
      />
    </>
  );
}
