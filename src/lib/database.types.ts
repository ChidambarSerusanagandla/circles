// Keep in sync with migrations. Replace with `supabase gen types typescript --local`
// when using the Supabase CLI against a running project.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};
type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};
type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  access_type: string;
  monthly_price: number | null;
  created_by: string;
  created_at: string;
  is_demo: boolean;
};
export type MessageRow = {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  created_at: string;
};
export type QuestionRow = MessageRow & {
  status: "pending" | "answered" | "skipped";
};
type EventRow = {
  id: string;
  user_id: string | null;
  anonymous_session_id: string;
  group_id: string | null;
  event_name: string;
  experiment_id: string | null;
  experiment_variant: string | null;
  metadata: Json;
  created_at: string;
  is_demo: boolean;
  dedupe_key: string;
};
export type Database = {
  public: {
    Tables: {
      growth_admins: Table<{ profile_id: string }>;
      profiles: Table<ProfileRow>;
      groups: Table<GroupRow>;
      group_admins: Table<{ group_id: string; profile_id: string }>;
      group_memberships: Table<{
        group_id: string;
        profile_id: string;
        status: string;
        joined_at: string;
      }>;
      messages: Table<MessageRow>;
      message_reactions: Table<{
        id: string;
        message_id: string;
        profile_id: string;
        reaction: string;
        created_at: string;
      }>;
      questions: Table<QuestionRow>;
      question_answers: Table<{
        id: string;
        question_id: string;
        admin_id: string;
        content: string;
        created_at: string;
      }>;
      analytics_events: Table<EventRow>;
      experiments: Table<{
        id: string;
        key: string;
        name: string;
        description: string;
        status: string;
      }>;
      experiment_assignments: Table<{
        id: string;
        experiment_id: string;
        anonymous_session_id: string;
        variant: string;
        assigned_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_group_admin: { Args: { target: string }; Returns: boolean };
      is_growth_admin: { Args: Record<string, never>; Returns: boolean };
      group_counts: {
        Args: Record<string, never>;
        Returns: { group_id: string; member_count: number }[];
      };
      reaction_counts: {
        Args: { message_ids: string[] };
        Returns: { message_id: string; reaction: string; total: number }[];
      };
      preview_messages: {
        Args: { group_ids: string[] };
        Returns: MessageRow[];
      };
      create_group: {
        Args: {
          group_name: string;
          group_slug: string;
          group_description: string;
          group_category: string;
        };
        Returns: string;
      };
      answer_question: {
        Args: { target: string; answer: string };
        Returns: undefined;
      };
      skip_question: { Args: { target: string }; Returns: undefined };
      preview_funnel: {
        Args: { demo: boolean };
        Returns: {
          variant: string;
          visitors: number;
          opens: number;
          joins: number;
        }[];
      };
      creator_metrics: {
        Args: { target: string; demo: boolean };
        Returns: {
          previews: number;
          opens: number;
          joins: number;
          questions: number;
          reactions: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
