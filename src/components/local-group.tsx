"use client";
import Link from "next/link";
import { useDemo } from "./demo-provider";
import { GroupView } from "./group-view";
export function LocalGroup({slug}:{slug:string}) {const {state,ready}=useDemo();if(!ready)return <div className="page empty" role="status">Loading your circle…</div>;const group=state.groups.find(g=>g.slug===slug);return group?<GroupView group={group} user={null} memberships={[]} reactions={[]} questions={[]} hasMore={false} page={1}/>:<div className="page empty"><h1>This circle couldn’t be found.</h1><p>Locally created demo circles are available only in the browser that created them.</p><Link className="button primary" href="/">Back to Discover</Link></div>;}
