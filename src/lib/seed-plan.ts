import { demoGroups, profiles, uid } from "./seed-data";
import { initialDemo } from "./demo";
import { sampleEvents } from "./analytics/sample";
export const seedPeople = [
  ...profiles.map((profile) => ({
    ...profile,
    handle: profile.display_name.split(" ")[0].toLowerCase(),
  })),
  { id: uid(900), display_name: "Alex Morgan", handle: "alex" },
  {
    id: uid(901),
    display_name: "Chidambar Rao Serusanagandla",
    handle: "chidambar",
  },
];
export const seedEmail = (index: number) =>
  `demo${String(index + 1).padStart(2, "0")}@circles.example`;
export function seedPlan(
  ids: Map<string, string> = new Map(seedPeople.map((p) => [p.id, p.id])),
) {
  const person = (id: string) => {
    const mapped = ids.get(id);
    if (!mapped) throw new Error("Missing seed account mapping.");
    return mapped;
  };
  const groups = demoGroups.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    category: g.category,
    access_type: g.access_type,
    monthly_price: g.monthly_price,
    created_by: person(g.created_by),
    is_demo: true,
  }));
  const admins = demoGroups.flatMap((g) =>
    g.admins.map((p) => ({ group_id: g.id, profile_id: person(p.id) })),
  );
  const messages = demoGroups.flatMap((g) =>
    g.messages.map((m) => ({
      id: m.id,
      group_id: g.id,
      author_id: person(m.author_id),
      content: m.content,
      created_at: m.created_at,
    })),
  );
  const memberships = demoGroups.flatMap((g) =>
    profiles.map((p) => ({
      group_id: g.id,
      profile_id: person(p.id),
      status: "active",
    })),
  );
  const reactions = demoGroups.flatMap((g) =>
    g.messages.flatMap((m, i) =>
      profiles.slice(0, (i % 3) + 1).map((p, j) => ({
        message_id: m.id,
        profile_id: person(p.id),
        reaction: j % 2 ? "👀" : "😂",
      })),
    ),
  );
  const questions = initialDemo.questions.map((q) => ({
    id: q.id,
    group_id: q.group_id,
    author_id: person(q.author_id),
    content: q.content,
    status: q.status,
    created_at: q.created_at,
  }));
  const events = sampleEvents().map((e) => ({
    ...e,
    dedupe_key: "simulation:" + e.id,
  }));
  const assignments = [
    ...new Map(
      events.map((e) => [
        e.anonymous_session_id,
        {
          experiment_id: e.experiment_id!,
          anonymous_session_id: e.anonymous_session_id,
          variant: e.experiment_variant!,
        },
      ]),
    ).values(),
  ];
  return {
    groups,
    admins,
    messages,
    memberships,
    reactions,
    questions,
    events,
    assignments,
    profiles: seedPeople.map((p) => ({
      id: person(p.id),
      display_name: p.display_name,
      handle: p.handle,
    })),
  };
}
