import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getUser } from "@/lib/data";
import { DEMO_MODE } from "@/lib/config";
import { getInboxMessagePage, getInboxThreads } from "@/lib/inbox/data";
import { InboxView } from "@/components/inbox-view";
import "../inbox.css";

export const metadata = { title: "Inbox" };
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const user = await getUser();
  if (!user)
    return (
      <div className="page empty">
        <MessageCircle size={36} className="empty-icon" />
        <h1>A little conversation, just between you.</h1>
        <p>Sign in to send and receive private messages.</p>
        <Link href="/profile?next=/inbox" className="button primary">
          Sign in
        </Link>
      </div>
    );
  const query = await searchParams;
  const threads = DEMO_MODE ? [] : await getInboxThreads(user.id);
  const selectedId = query.thread || threads[0]?.id || "";
  const page =
    !DEMO_MODE && threads.some((thread) => thread.id === selectedId)
      ? await getInboxMessagePage(selectedId)
      : { messages: [], hasOlder: false };
  return (
    <InboxView
      key={`${user.id}:${selectedId}`}
      user={user}
      threads={threads}
      selectedId={selectedId}
      initialPage={page}
    />
  );
}
