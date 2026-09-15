import type { Category, Group, Profile } from "./types";
export const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const profiles: Profile[] = [
  "Rahul Mehta",
  "Arjun Shah",
  "Priya Kapoor",
  "Maya Chen",
  "Leo Brooks",
  "Sofia Reyes",
  "Noah Williams",
  "Amara Okafor",
  "Ellie Park",
  "Sam Rivera",
].map((display_name, i) => ({
  id: uid(i + 1),
  display_name,
  handle: display_name.split(" ")[0].toLowerCase(),
}));
type Seed = {
  name: string;
  slug: string;
  description: string;
  category: Category;
  admins: number[];
  lines: [number, string][];
};
const seeds: Seed[] = [
  {
    name: "Roommates After Midnight",
    slug: "roommates-after-midnight",
    description: "Three roommates. One apartment. Absolutely no milk.",
    category: "Roommates",
    admins: [0, 1, 2],
    lines: [
      [0, "Bro who finished all the milk?"],
      [1, "Not me 😂"],
      [0, "There’s literally an empty carton in the fridge."],
      [2, "Check Arjun’s protein shake 👀"],
      [1, "Why am I always the suspect 😭"],
      [2, "Because your alibi has 30 grams of protein."],
      [0, "The carton was put back with the lid on. That’s premeditated."],
      [1, "Okay but I left enough for one emotionally small coffee."],
      [
        2,
        "Adding milk to the shared list. And a tiny detective hat for Rahul.",
      ],
      [0, "Already own one. Don’t ask why."],
    ],
  },
  {
    name: "The Unqualified Life Coaches",
    slug: "unqualified-life-coaches",
    description:
      "Good friends. Questionable advice. Surprisingly useful sometimes.",
    category: "Friendship",
    admins: [3, 4, 5],
    lines: [
      [3, "I said ‘you too’ when the dentist said enjoy your weekend."],
      [4, "That’s normal? Dentists have weekends."],
      [3, "It was Tuesday. And he said enjoy your new crown."],
      [5, "Honestly generous of you. A crown for everyone."],
      [4, "A very diplomatic response, your majesty."],
      [3, "I’m finding a new dentist."],
      [5, "You can’t keep moving every time you have a social interaction."],
      [3, "Watch me."],
      [
        4,
        "New rule: we all get one awkward sentence a day with no consequences.",
      ],
      [5, "Only one? I’ll need a family plan."],
    ],
  },
  {
    name: "Meeting Could’ve Been a Meme",
    slug: "meeting-couldve-been-a-meme",
    description: "The unofficial minutes of working life.",
    category: "Comedy",
    admins: [6, 7, 8],
    lines: [
      [6, "Today’s icebreaker: describe yourself as a spreadsheet function."],
      [7, "IFERROR."],
      [8, "Mine is a circular reference. I keep coming back to lunch."],
      [6, "I said SUM because I bring people together."],
      [7, "Did that work?"],
      [6, "They made me organize the next icebreaker."],
      [8, "A classic promotion to unpaid fun manager."],
      [7, "Next time say FILTER and leave the meeting."],
      [6, "I’ve created a form to gather icebreaker preferences."],
      [8, "The spreadsheet has become self-aware."],
    ],
  },
  {
    name: "It’s a Two-Way Street",
    slug: "two-way-street",
    description: "Honest conversations about figuring each other out.",
    category: "Relationships",
    admins: [2, 3, 9],
    lines: [
      [9, "Is sending a calendar invite for date night romantic or alarming?"],
      [3, "Does it have an agenda?"],
      [9, "Dinner. Walk. Optional dessert."],
      [2, "Remove optional immediately."],
      [3, "Add a location. Nothing says romance like not having to decide."],
      [9, "They accepted and added a note: ‘dessert is mandatory.’"],
      [2, "Excellent alignment across stakeholders."],
      [3, "We’re joking but making time on purpose is actually lovely."],
      [
        9,
        "That’s what I was hoping. Busy weeks need little things to look forward to.",
      ],
      [2, "Exactly. Also, order two desserts."],
    ],
  },
  {
    name: "The Next Chapter",
    slug: "the-next-chapter",
    description: "Small wins and honest notes on building a career.",
    category: "Career",
    admins: [7, 4, 6],
    lines: [
      [7, "I finally asked the question I thought was too basic."],
      [4, "And?"],
      [7, "Three people messaged me saying they didn’t understand it either."],
      [6, "The unofficial team spokesperson for ‘wait, why?’"],
      [
        4,
        "I keep a notebook of things I’m afraid to ask. It’s getting shorter.",
      ],
      [7, "Because you’ve asked them?"],
      [
        4,
        "Mostly. One was ‘where is the good coffee.’ That unlocked everything.",
      ],
      [
        6,
        "My best career advice is to explain what you tried before asking for help.",
      ],
      [7, "And write down the answer for the next person."],
      [4, "Including the coffee location. Especially that."],
    ],
  },
  {
    name: "One More Detour",
    slug: "one-more-detour",
    description: "The best part of the trip is rarely on the itinerary.",
    category: "Travel",
    admins: [5, 8, 9],
    lines: [
      [5, "We missed the train."],
      [8, "By how much?"],
      [5, "One pastry."],
      [9, "A legitimate unit of time."],
      [5, "The bakery owner drew us a walking route while we wait."],
      [8, "This is how every good travel story starts."],
      [9, "Or every very long walking route."],
      [5, "Update: tiny bookshop, riverside bench, second pastry."],
      [8, "Are we sure the train was the destination?"],
      [5, "Revising the itinerary to ‘see what happens.’"],
    ],
  },
];
export const demoGroups: Group[] = seeds.map((seed, i) => ({
  id: uid(100 + i),
  name: seed.name,
  slug: seed.slug,
  description: seed.description,
  category: seed.category,
  access_type: "free",
  monthly_price: null,
  created_by: profiles[seed.admins[0]].id,
  admins: seed.admins.map((n) => profiles[n]),
  member_count: [124, 86, 213, 67, 48, 92][i],
  messages: seed.lines.map(([author, content], j) => ({
    id: uid(1000 + i * 100 + j),
    group_id: uid(100 + i),
    author_id: profiles[author].id,
    author: profiles[author],
    content,
    created_at: new Date(
      Date.UTC(2026, 8, 10, 21, i * 10 + j * 2),
    ).toISOString(),
    reactions:
      j % 3 === 0
        ? { "😂": 7 + i + j, "👀": 3 + i }
        : j % 3 === 1
          ? { "❤️": 4 + j }
          : {},
  })),
}));
export const categories = [
  "Roommates",
  "Friendship",
  "Comedy",
  "Relationships",
  "Career",
  "Travel",
] as const;
