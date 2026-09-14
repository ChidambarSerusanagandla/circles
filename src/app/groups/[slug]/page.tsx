import { LocalGroup } from "@/components/local-group";
import { DEMO_MODE } from "@/lib/config";
import { notFound } from "next/navigation";
import { getGroup, getMessages, getParticipation } from "@/lib/data";
import { GroupView } from "@/components/group-view";
type Props={params:Promise<{slug:string}>;searchParams:Promise<{page?:string}>};
export async function generateMetadata({params}:Props) {const group=await getGroup((await params).slug);return {title:group?.name||"Circle not found",description:group?.description};}
export default async function GroupPage({params,searchParams}:Props) {
  const {slug}=await params;const group=await getGroup(slug);if(!group){if(DEMO_MODE)return <LocalGroup slug={slug}/>;notFound();}
  const rawPage=Number((await searchParams).page||1);const page=Number.isInteger(rawPage)?Math.max(1,Math.min(rawPage,1000)):1;
  const [messages,participation]=await Promise.all([getMessages(group.id,51,(page-1)*50),getParticipation(group.id)]);
  return <GroupView group={{...group,messages:messages.slice(0,50)}} {...participation} hasMore={messages.length>50} page={page}/>;
}
