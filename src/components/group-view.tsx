"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, MessageCircle } from "lucide-react";
import type {
  Group,
  Message as MessageType,
  Profile,
  Question,
  Reaction,
} from "@/lib/types";
import { REACTIONS } from "@/lib/types";
import { joinGroup, reactToMessage, submitQuestion } from "@/app/actions";
import {
  askDemo,
  demoMemberCount,
  demoReactionCount,
  hasDemoMembership,
  joinDemo,
  reactDemo,
  reactionKey,
} from "@/lib/demo";
import { useDemo, updateDemo } from "./demo-provider";
import { AvatarStack } from "./avatar";
import { Message } from "./message";
import { PageEvent, useAnalytics } from "./analytics-provider";
type Props = {
  group: Group;
  user: Profile | null;
  memberships: string[];
  reactions: { message_id: string; reaction: string }[];
  questions: Question[];
  hasMore: boolean;
  page: number;
};
export function GroupView({
  group,
  user: liveUser,
  memberships,
  reactions,
  questions,
  hasMore,
  page,
}: Props) {
  const track = useAnalytics();
  const { state, isDemo } = useDemo();
  const user = isDemo ? state.user : liveUser;
  const joined = isDemo
    ? hasDemoMembership(state, group.id)
    : memberships.includes(group.id);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const messages = [
    ...group.messages,
    ...(isDemo ? state.messages.filter((m) => m.group_id === group.id) : []),
  ];
  const ownQuestions = (isDemo ? state.questions : questions).filter(
    (q) => q.group_id === group.id && q.author_id === user?.id,
  );
  const selected = (id: string, reaction: Reaction) =>
    isDemo
      ? state.reactions.includes(
          reactionKey(id, reaction, state.user?.id || "anonymous"),
        )
      : reactions.some((r) => r.message_id === id && r.reaction === reaction);
  function renderReactions(message: MessageType) {
    return (
      <div
        className="reactions interactive-reactions"
        aria-label={`React to ${message.author.display_name.split(" ")[0]}’s message`}
      >
        {REACTIONS.map((emoji) => {
          const active = selected(message.id, emoji);
          const count =
            (message.reactions[emoji] || 0) +
            (isDemo ? demoReactionCount(state, message.id, emoji) : 0);
          return (
            <button
              key={emoji}
              className={`reaction ${active ? "chosen" : ""}`}
              aria-label={`${emoji} reaction${count ? `, ${count}` : ""}`}
              aria-pressed={active}
              disabled={pending}
              onClick={() => {
                if (!user) {
                  setNotice(
                    "Sign in to react. You can keep reading without an account.",
                  );
                  return;
                }
                startTransition(async () => {
                  const result = isDemo
                    ? updateDemo((s) => reactDemo(s, message.id, emoji))
                    : await reactToMessage(message.id, emoji, active);
                  if (result.ok && isDemo && !active)
                    track("reaction_added", group.id);
                  setNotice(
                    result.ok
                      ? active
                        ? "Reaction removed."
                        : "Reaction added."
                      : result.message,
                  );
                  if (result.ok && !isDemo) router.refresh();
                });
              }}
            >
              {emoji}
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="page group-page">
      <PageEvent key={group.id} name="group_opened" groupId={group.id} />
      <Link href="/" className="back-link">
        <ArrowLeft size={16} />
        Back to Discover
      </Link>
      <div className="group-layout">
        <section>
          <div className="group-heading">
            <span
              className={`category category-${group.category.toLowerCase()}`}
            >
              {group.category}
            </span>
            <h1>{group.name}</h1>
            <p>{group.description}</p>
            <div className="card-people">
              <AvatarStack people={group.admins} />
              <span>
                {group.admins.length}{" "}
                {group.admins.length === 1 ? "voice" : "voices"}
              </span>
              <span>·</span>
              <span>
                {group.member_count +
                  (isDemo ? demoMemberCount(state, group.id) : 0)}{" "}
                members{isDemo || group.is_demo ? " · Demo data" : ""}
              </span>
            </div>
          </div>
          <div className="conversation-panel">
            <div className="conversation-date">
              THE CONVERSATION <span>Times shown in UTC</span>
            </div>
            {messages.length ? (
              messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  reactionControls={renderReactions(message)}
                />
              ))
            ) : (
              <div className="small-empty">
                The creators are warming up. The first message will appear here.
              </div>
            )}
            {(hasMore || page > 1) && (
              <div className="pagination">
                {page > 1 && (
                  <Link className="button" href={`?page=${page - 1}`}>
                    Previous messages
                  </Link>
                )}
                {hasMore && (
                  <Link className="button" href={`?page=${page + 1}`}>
                    Next messages
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="reading-note">
            <LockKeyhole size={15} />
            Only creators post here. Everyone gets a front-row seat.
          </div>
        </section>
        <aside className="group-sidebar">
          <div className="side-card">
            <span className="eyebrow">MAKE YOURSELF AT HOME</span>
            <h2>
              {joined ? "You’re part of the circle." : "Your seat is waiting."}
            </h2>
            <p>
              Join to keep this circle close and send a question to the people
              behind the conversation.
            </p>
            {!user ? (
              <Link
                href={`/profile?next=${encodeURIComponent(`/groups/${group.slug}`)}`}
                className="button primary"
              >
                Sign in to join
              </Link>
            ) : (
              <button
                disabled={pending || joined}
                className={`button ${joined ? "joined" : "primary"}`}
                onClick={() =>
                  startTransition(async () => {
                    const result = isDemo
                      ? updateDemo((s) => joinDemo(s, group))
                      : await joinGroup(group.id);
                    if (result.ok && isDemo) track("group_joined", group.id);
                    setNotice(
                      result.ok
                        ? group.access_type === "premium"
                          ? "You joined the premium demo. No payment was taken."
                          : "You’re in. Make yourself at home."
                        : result.message,
                    );
                    if (result.ok && !isDemo) router.refresh();
                  })
                }
              >
                {joined ? (
                  <>
                    <Check size={17} />
                    Joined
                  </>
                ) : group.access_type === "premium" ? (
                  `Join · $${group.monthly_price?.toFixed(2)} / month`
                ) : (
                  "Join this circle"
                )}
              </button>
            )}
            <span className="fine-print">
              {group.access_type === "premium"
                ? "Demo membership. No payment is collected."
                : "Free to join. Always welcome to watch."}
            </span>
            {notice && (
              <p className="notice" role="status">
                {notice}
                {!user && (
                  <Link
                    href={`/profile?next=${encodeURIComponent(`/groups/${group.slug}`)}`}
                  >
                    {" "}
                    Sign in
                  </Link>
                )}
              </p>
            )}
          </div>
          <div className="side-card question-card">
            <MessageCircle size={22} />
            <h3>Ask the people behind it.</h3>
            <p>
              Send a question. If a creator answers, it’ll appear in the
              conversation for everyone.
            </p>
            {joined && user ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const content = String(new FormData(form).get("question"));
                  startTransition(async () => {
                    const result = isDemo
                      ? updateDemo((s) => askDemo(s, group.id, content))
                      : await submitQuestion(group.id, content);
                    if (result.ok && isDemo)
                      track("question_submitted", group.id);
                    setNotice(
                      result.ok
                        ? "Question sent. A creator can answer it in the conversation."
                        : result.message,
                    );
                    if (result.ok) {
                      form.reset();
                      if (!isDemo) router.refresh();
                    }
                  });
                }}
              >
                <label htmlFor="question">Your question</label>
                <textarea
                  id="question"
                  name="question"
                  placeholder="I’ve been wondering…"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={4}
                />
                <button className="button" disabled={pending}>
                  Send question
                </button>
              </form>
            ) : (
              <span className="muted">Join this circle to ask a question.</span>
            )}
            {ownQuestions.length > 0 && (
              <div className="own-questions">
                <h4>Your questions</h4>
                {ownQuestions.map((q) => (
                  <div key={q.id}>
                    <p>{q.content}</p>
                    <span className={`status status-${q.status}`}>
                      {q.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
