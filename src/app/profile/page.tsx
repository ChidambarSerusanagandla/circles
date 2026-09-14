import { safeReturnPath } from "@/lib/return-path";
import { getUser } from "@/lib/data";
import { ProfileView } from "@/components/profile-view";
export const metadata = { title: "Profile" };
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <ProfileView
      user={await getUser()}
      next={safeReturnPath((await searchParams).next)}
    />
  );
}
