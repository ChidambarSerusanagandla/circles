import { notFound, redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
export default async function LegacyExperiments() {
  if (!(await getAccess()).internal) notFound();
  redirect("/internal/growth");
}
