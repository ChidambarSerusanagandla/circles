"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpRight, MessageCircle, Send } from "lucide-react";
import type { Profile } from "@/lib/types";
import type {
  InboxMessage,
  InboxPage,
  InboxThreadView,
} from "@/lib/inbox/types";
import {
  demoInboxMessages,
  demoInboxThreads,
  sendDemoMessage,
  startDemoThread,
} from "@/lib/inbox/demo";
import {
  loadOlderInboxMessages,
  sendInboxMessage,
  startInboxThread,
} from "@/app/inbox/actions";
import { useDemo, updateDemo } from "./demo-provider";
import { Avatar } from "./avatar";

function timestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function InboxView({
  user,
  threads: liveThreads,
  selectedId,
  initialPage,
}: {
  user: Profile;
  threads: InboxThreadView[];
  selectedId: string;
  initialPage: InboxPage;
}) {
  const { state, isDemo } = useDemo();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [handle, setHandle] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [liveMessages, setLiveMessages] = useState<InboxMessage[]>(
    initialPage.messages,
  );
  const [hasOlder, setHasOlder] = useState(initialPage.hasOlder);
  const [demoLimit, setDemoLimit] = useState(50);
  const threads = isDemo ? demoInboxThreads(state) : liveThreads;
  const selected =
    threads.find((thread) => thread.id === selectedId) ||
    (!selectedId ? threads[0] : undefined);
  const demoMessages =
    selected && isDemo ? demoInboxMessages(state, selected.id) : [];
  const messages = isDemo ? demoMessages.slice(-demoLimit) : liveMessages;
  const more = isDemo ? demoMessages.length > demoLimit : hasOlder;

  function startConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    startTransition(async () => {
      if (isDemo) {
        let threadId = "";
        const result = updateDemo((current) => {
          const started = startDemoThread(current, handle);
          threadId = started.threadId;
          return started.state;
        });
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
        router.push(`/inbox?thread=${threadId}`);
      } else {
        const result = await startInboxThread(handle);
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
        router.push(`/inbox?thread=${result.data}`);
        router.refresh();
      }
      setHandle("");
    });
  }
  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setNotice("");
    startTransition(async () => {
      if (isDemo) {
        const result = updateDemo((current) =>
          sendDemoMessage(current, selected.id, draft),
        );
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
      } else {
        const result = await sendInboxMessage(selected.id, draft);
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
        setLiveMessages((current) => [...current, result.data]);
        router.refresh();
      }
      setDraft("");
      setNotice("Message sent.");
    });
  }
  function loadOlder() {
    if (!selected || !messages.length) return;
    if (isDemo) {
      setDemoLimit((current) => current + 50);
      return;
    }
    startTransition(async () => {
      const result = await loadOlderInboxMessages(selected.id, messages[0]);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setLiveMessages((current) => [...result.data.messages, ...current]);
      setHasOlder(result.data.hasOlder);
    });
  }

  return (
    <div className="page inbox-page">
      <div className="page-heading">
        <span className="eyebrow">JUST BETWEEN YOU</span>
        <h1>Inbox</h1>
        <p>Keep a good conversation going, one person at a time.</p>
      </div>
      <div className="inbox-layout">
        <aside
          className="inbox-sidebar"
          aria-label="Your private conversations"
        >
          <form onSubmit={startConversation} className="inbox-new">
            <h2>New message</h2>
            <label htmlFor="inbox-handle">Find someone by handle</label>
            <div className="inbox-handle-row">
              <input
                id="inbox-handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="@handle"
                maxLength={31}
                autoCapitalize="none"
                autoComplete="off"
                required
              />
              <button
                className="button secondary"
                disabled={pending}
                type="submit"
                aria-label="Open conversation"
              >
                <ArrowUpRight size={19} />
              </button>
            </div>
          </form>
          <nav aria-label="Conversations" className="inbox-thread-list">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/inbox?thread=${thread.id}`}
                className={`inbox-thread ${selected?.id === thread.id ? "selected" : ""}`}
                aria-current={selected?.id === thread.id ? "page" : undefined}
              >
                <Avatar person={thread.peer} />
                <span>
                  <strong>{thread.peer.display_name}</strong>
                  <small>
                    {thread.peer.handle
                      ? `@${thread.peer.handle}`
                      : "Private conversation"}
                  </small>
                </span>
              </Link>
            ))}
            {!threads.length && (
              <p className="inbox-list-empty">
                Your private conversations will appear here.
              </p>
            )}
          </nav>
        </aside>
        <section
          className="inbox-conversation"
          aria-label={
            selected
              ? `Conversation with ${selected.peer.display_name}`
              : "Private messages"
          }
        >
          {selected ? (
            <>
              <header className="inbox-conversation-header">
                <Avatar person={selected.peer} />
                <div>
                  <h2>{selected.peer.display_name}</h2>
                  <p>
                    {selected.peer.handle
                      ? `@${selected.peer.handle}`
                      : "Private conversation"}
                  </p>
                </div>
              </header>
              <div className="inbox-history">
                {more && (
                  <button
                    onClick={loadOlder}
                    disabled={pending}
                    className="text-button inbox-older"
                  >
                    Load earlier messages
                  </button>
                )}
                {messages.length ? (
                  <ol className="inbox-messages">
                    {messages.map((message) => (
                      <li
                        key={message.id}
                        className={
                          message.sender_id === user.id ? "sent" : "received"
                        }
                      >
                        <span className="inbox-message-author">
                          {message.sender_id === user.id
                            ? "You"
                            : selected.peer.display_name}
                        </span>
                        <p>{message.content}</p>
                        <time dateTime={message.created_at}>
                          {timestamp(message.created_at)} UTC
                        </time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="inbox-no-messages">
                    <MessageCircle size={30} />
                    <h3>Start with a hello.</h3>
                    <p>
                      Say hello to {selected.peer.display_name.split(" ")[0]}{" "}
                      and see where the conversation goes.
                    </p>
                  </div>
                )}
              </div>
              <form onSubmit={send} className="inbox-compose">
                <label htmlFor="inbox-message">Your message</label>
                <textarea
                  id="inbox-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Write something…"
                  required
                />
                <div>
                  <span className="muted">
                    {draft.length.toLocaleString()} / 2,000
                  </span>
                  <button
                    className="button primary"
                    type="submit"
                    disabled={pending || !draft.trim()}
                  >
                    <Send size={16} />
                    {pending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="inbox-no-messages">
              <MessageCircle size={36} />
              <h2>
                {selectedId
                  ? "This conversation is unavailable."
                  : "Make room for a little conversation."}
              </h2>
              <p>
                {selectedId
                  ? "Choose a conversation from your Inbox."
                  : "Open a conversation or enter someone’s handle to say hello."}
              </p>
            </div>
          )}
        </section>
      </div>
      <p className="inbox-notice" role="status" aria-live="polite">
        {notice}
      </p>
      {isDemo && (
        <p className="inbox-demo-note">
          Demo messages stay in this browser. Switch demo accounts to try both
          sides; no messages are delivered externally.
        </p>
      )}
    </div>
  );
}
