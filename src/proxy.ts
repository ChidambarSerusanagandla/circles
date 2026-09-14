import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE, supabaseConfig } from "./lib/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  if (!DEMO_MODE) {
    const {url,key} = supabaseConfig();
    const db = createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
    await db.auth.getClaims();
  }
  response.headers.set("Cache-Control","private, no-store");
  return response;
}
export const config = {matcher:["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"]};
