"use client";
import Link from "next/link";
import { ArrowUpRight, UsersRound } from "lucide-react";
import type { Group, Profile } from "@/lib/types";
import { hasDemoMembership } from "@/lib/demo";
import { useDemo } from "./demo-provider";
import { AvatarStack } from "./avatar";
export function MyGroups({groups:baseGroups,user:liveUser,memberships}:{groups:Group[];user:Profile|null;memberships:string[]}) {
  const {state,isDemo}=useDemo();const user=isDemo?state.user:liveUser;const groups=[...baseGroups,...(isDemo?state.groups:[])];
  if(!user)return <div className="page empty"><UsersRound size={36} className="empty-icon"/><h1>A place for your favorites.</h1><p>Sign in to keep the circles you join in one place.</p><Link className="button primary" href="/profile">Sign in{isDemo?" or try the demo":""}</Link></div>;
  const joined=groups.filter(g=>isDemo?hasDemoMembership(state,g.id):memberships.includes(g.id));const managed=groups.filter(g=>g.admins.some(a=>a.id===user.id));
  function list(items:Group[],empty:string) {return items.length?<div className="group-list">{items.map(group=><Link key={group.id} href={`/groups/${group.slug}`} className="group-list-item"><AvatarStack people={group.admins}/><div><h3>{group.name}</h3><p>{group.description}</p></div><ArrowUpRight size={19}/></Link>)}</div>:<div className="small-empty"><p>{empty}</p><Link className="text-button" href="/">Find a conversation <ArrowUpRight size={15}/></Link></div>;}
  return <div className="page library-page"><div className="page-heading"><span className="eyebrow">GOOD COMPANY, ALL IN ONE PLACE</span><h1>My Groups</h1><p>Pick up where the conversation left off.</p></div><section className="library-section"><h2>Joined circles <span>{joined.length}</span></h2>{list(joined,"You haven’t joined a circle yet. Something good is waiting on Discover.")}</section><section className="library-section"><h2>Circles I manage <span>{managed.length}</span></h2>{list(managed,"Your creator circles will appear here.")}{managed.length>0&&<Link href="/admin" className="text-button">Open creator dashboard <ArrowUpRight size={15}/></Link>}</section></div>;
}
