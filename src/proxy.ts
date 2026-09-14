import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE, supabaseConfig } from "./lib/config";
import { VISITOR_COOKIE } from "./lib/experiments/assignment";
export async function proxy(request: NextRequest) {
  const previous=request.cookies.get(VISITOR_COOKIE)?.value;
  const visitor=previous && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previous)?previous:crypto.randomUUID();
  request.cookies.set(VISITOR_COOKIE,visitor);
  let response = NextResponse.next({request});
  if (!DEMO_MODE) {
    const {url,key} = supabaseConfig();
    const db = createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
    await db.auth.getClaims();
  }
  response.headers.set("Cache-Control","private, no-store");
  if(visitor!==previous)response.cookies.set(VISITOR_COOKIE,visitor,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"&&!request.nextUrl.hostname.match(/^(localhost|127\.0\.0\.1)$/),maxAge:60*60*24*365,path:"/"});
  return response;
}
export const config = {matcher:["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"]};
