import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/config";
import { getUser } from "@/lib/data";
import { getAssignment } from "@/lib/experiments/server";
import { browserEventInput } from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/server";
import { analyticsDatabase } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const receivedAt = new Date().toISOString();
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  if (DEMO_MODE) return new Response(null, { status: 204 });
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048)
      return new Response(null, { status: 413 });
    const raw = await request.text();
    if (raw.length > 2048) return new Response(null, { status: 413 });
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = browserEventInput.safeParse(input);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    const event = parsed.data;
    const assignment = await getAssignment();
    const db = analyticsDatabase();
    const { count, error } = await db
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("anonymous_session_id", assignment.visitorId)
      .gte("created_at", new Date(Date.now() - 60000).toISOString());
    if (error) throw error;
    if ((count || 0) >= 120) return new Response(null, { status: 429 });
    if (
      event.name === "group_preview_seen" &&
      event.experimental &&
      (!assignment.active || event.renderedVariant !== assignment.variant)
    )
      return new Response(null, { status: 409 });
    const rendered =
      event.name === "group_preview_seen" && !event.experimental
        ? { ...assignment, active: false, attributed: false }
        : assignment;
    const user = await getUser();
    await trackServerEvent(
      event.name,
      event.groupId || null,
      user?.id || null,
      `${assignment.visitorId}:${event.id}`,
      receivedAt,
      rendered,
    );
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Analytics temporarily unavailable" },
      { status: 503 },
    );
  }
}
