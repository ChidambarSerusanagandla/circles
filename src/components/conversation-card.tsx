import Link from "next/link";
import { ArrowUpRight, UsersRound } from "lucide-react";
import type { Group } from "@/lib/types";
import { AvatarStack } from "./avatar";
import { Message } from "./message";
export function ConversationCard({ group, length = 4 }: { group: Group; length?: number }) {
  return <article className="conversation-card"><div className="card-heading"><div className="card-badges"><span className={`category category-${group.category.toLowerCase()}`}>{group.category}</span><span className={group.access_type === "premium" ? "access premium" : "access"}>{group.access_type === "premium" ? `${group.monthly_price?.toFixed(2)} / mo · Demo` : "Free to join"}</span></div><Link href={`/groups/${group.slug}`} className="card-title"><h2>{group.name}</h2></Link><p className="card-description">{group.description}</p><div className="card-people"><AvatarStack people={group.admins}/><span>{group.admins.length} voices</span><span className="watchers"><UsersRound size={14}/>{group.member_count.toLocaleString()} members</span></div></div><div className="card-conversation" data-preview-observation>{group.messages.slice(0,length).map(message => <Message key={message.id} message={message} compact/>)}</div><Link href={`/groups/${group.slug}`} className="card-cta" aria-label={`Continue watching ${group.name}`}>Continue watching<ArrowUpRight size={18}/></Link></article>;
}
