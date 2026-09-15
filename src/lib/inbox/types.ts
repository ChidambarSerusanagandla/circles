import type { Profile } from "../types";

export interface InboxThread {
  id: string;
  participant_low: string;
  participant_high: string;
  created_at: string;
  updated_at: string;
}
export interface InboxMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
export interface InboxThreadView extends InboxThread {
  peer: Profile;
}
export interface InboxPage {
  messages: InboxMessage[];
  hasOlder: boolean;
}
