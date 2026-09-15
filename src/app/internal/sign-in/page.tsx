import { notFound } from "next/navigation";
import { DEMO_MODE } from "@/lib/config";
import { DemoAccess } from "@/components/demo-access";
export const metadata = { title: "Internal access" };
export default function InternalSignIn() {
  if (!DEMO_MODE) notFound();
  return <DemoAccess internal />;
}
