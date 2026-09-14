import { getUser } from "@/lib/data";
import { ProfileView } from "@/components/profile-view";
export const metadata={title:"Profile"};
export default async function ProfilePage() {return <ProfileView user={await getUser()}/>;}
