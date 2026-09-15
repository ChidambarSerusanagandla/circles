export const REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "👀"] as const;
export type Reaction = (typeof REACTIONS)[number];
export type Variant = "A" | "B";
export type Category =
  "Roommates" | "Friendship" | "Comedy" | "Relationships" | "Career" | "Travel";
export interface Profile {
  id: string;
  display_name: string;
  handle?: string | null;
  avatar_url?: string | null;
}
export interface Message {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: Profile;
  reactions: Partial<Record<Reaction, number>>;
}
export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: Category;
  access_type: "free" | "premium";
  monthly_price: number | null;
  created_by: string;
  is_demo?: boolean;
  admins: Profile[];
  member_count: number;
  messages: Message[];
}
export interface Question {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  status: "pending" | "answered" | "skipped";
  created_at: string;
  answer?: string;
}
export const EVENT_NAMES = [
  "discover_viewed",
  "group_preview_seen",
  "group_opened",
  "group_joined",
  "reaction_added",
  "question_submitted",
  "experiment_exposed",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export interface AnalyticsEvent {
  id: string;
  user_id: string | null;
  anonymous_session_id: string;
  group_id: string | null;
  event_name: EventName;
  experiment_id: string | null;
  experiment_variant: Variant | null;
  metadata: Record<string, unknown>;
  created_at: string;
  is_demo: boolean;
}
export interface ActionResult {
  ok: boolean;
  message: string;
}
