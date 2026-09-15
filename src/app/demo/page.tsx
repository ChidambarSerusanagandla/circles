import { notFound } from "next/navigation";
import { DEMO_MODE } from "@/lib/config";
import { DemoAccess } from "@/components/demo-access";
export const metadata = { title: "Review accounts" };
export default function DemoPage() {
  if (!DEMO_MODE) notFound();
  return <DemoAccess />;
}
