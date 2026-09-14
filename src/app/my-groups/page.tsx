import { getGroups, getParticipation } from "@/lib/data";
import { MyGroups } from "@/components/my-groups";
export const metadata={title:"My Groups"};
export default async function MyGroupsPage() {const [groups,participation]=await Promise.all([getGroups(),getParticipation()]);return <MyGroups groups={groups} user={participation.user} memberships={participation.memberships}/>;}
