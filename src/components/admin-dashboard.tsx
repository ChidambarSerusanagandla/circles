"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, PenLine, Plus, ShieldCheck } from "lucide-react";
import type { Group, Profile, Question } from "@/lib/types";
import { categories } from "@/lib/seed-data";
import { createGroup, moderateQuestion, postMessage } from "@/app/actions";
import { createDemo, moderateDemo, postDemo } from "@/lib/demo";
import {
  creatorMetrics,
  percent,
  rate,
  type CreatorMetrics,
} from "@/lib/analytics/metrics";
import { sampleEvents } from "@/lib/analytics/sample";
import { useDemo, updateDemo } from "./demo-provider";
const samples = sampleEvents();
type Props = {
  groups: Group[];
  user: Profile | null;
  questions: Question[];
  metrics: Record<string, CreatorMetrics>;
};
export function AdminDashboard({
  groups: baseGroups,
  user: liveUser,
  questions: liveQuestions,
  metrics,
}: Props) {
  const { state, isDemo } = useDemo();
  const user = isDemo ? state.user : liveUser;
  const groups = [...baseGroups, ...(isDemo ? state.groups : [])].filter((g) =>
    g.admins.some((a) => a.id === user?.id),
  );
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const group = groups.find((g) => g.id === selected) || groups[0];
  if (!user)
    return (
      <div className="page empty">
        <ShieldCheck className="empty-icon" size={36} />
        <h1>The creator’s corner.</h1>
        <p>
          Sign in to manage your circles, publish messages and answer your
          readers.
        </p>
        <Link className="button primary" href="/profile">
          Sign in{isDemo ? " or try creator mode" : ""}
        </Link>
      </div>
    );
  const questions = (isDemo ? state.questions : liveQuestions).filter(
    (q) => q.group_id === group?.id,
  );
  const waiting = questions.filter((q) => q.status === "pending");
  const stats = group
    ? isDemo
      ? creatorMetrics(samples, group.id, true)
      : metrics[group.id]
    : undefined;
  return (
    <div className="page admin-page">
      <div className="dashboard-heading">
        <div className="page-heading">
          <span className="eyebrow">BEHIND THE CONVERSATION</span>
          <h1>Creator studio</h1>
          <p>
            A little insight. A little inspiration. Your circle’s next chapter.
          </p>
        </div>
        <button className="button" onClick={() => setCreating(!creating)}>
          <Plus size={16} />
          {creating ? "Close form" : "New circle"}
        </button>
      </div>
      {creating && (
        <section className="surface create-form">
          <h2>Create a free circle</h2>
          <p className="muted">
            You’ll be its first creator. Give readers a reason to stop and read.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const fields = Object.fromEntries(new FormData(form));
              startTransition(async () => {
                const result = isDemo
                  ? updateDemo((s) => createDemo(s, fields))
                  : await createGroup(fields);
                setNotice(
                  result.ok
                    ? "Circle created. Choose it below to publish its first message."
                    : result.message,
                );
                if (result.ok) {
                  form.reset();
                  setCreating(false);
                  router.refresh();
                }
              });
            }}
          >
            <div className="form-grid">
              <label>
                Circle name
                <input name="name" required minLength={3} maxLength={80} />
              </label>
              <label>
                Address
                <input
                  name="slug"
                  placeholder="your-circle-name"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={240}
              />
            </label>
            <label>
              Category
              <select name="category">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button className="button primary" disabled={pending}>
              Create circle
            </button>
          </form>
        </section>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {!group ? (
        <div className="small-empty">
          You don’t manage a circle yet. Create one to start a conversation.
        </div>
      ) : (
        <>
          <div className="studio-toolbar">
            <label htmlFor="managed-group">
              Your circle
              <select
                id="managed-group"
                value={group.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <Link className="text-button" href={`/groups/${group.slug}`}>
              View conversation <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="section-heading">
            <h2>How your circle is doing</h2>
            <span className="demo-label">
              {isDemo
                ? "Demo data · Simulated history"
                : "Measured events · All time"}
            </span>
          </div>
          {stats && (
            <>
              <div className="metrics-grid">
                {[
                  ["Preview views", stats.previews],
                  ["Group opens", stats.opens],
                  ["Joined", stats.joins],
                  ["Questions", stats.questions],
                  ["Reactions", stats.reactions],
                ].map(([label, value]) => (
                  <div className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{Number(value).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
              <div className="conversion-strip">
                <span>
                  Preview → Open{" "}
                  <strong>{percent(rate(stats.opens, stats.previews))}</strong>
                </span>
                <span>
                  Open → Join{" "}
                  <strong>{percent(rate(stats.joins, stats.opens))}</strong>
                </span>
                <span className="muted">
                  Unique visitors · 7-day ordered funnel
                </span>
              </div>
            </>
          )}
          {isDemo && (
            <p className="metrics-footnote">
              Historical metrics above are simulated. In this browser:{" "}
              {state.messages.filter((m) => m.group_id === group.id).length}{" "}
              creator messages added and{" "}
              {questions.filter((q) => q.status !== "pending").length} questions
              reviewed.
            </p>
          )}
          <div className="studio-columns">
            <section className="surface">
              <div className="section-heading">
                <h2>Questions from your circle</h2>
                <span className="count-badge">{waiting.length} pending</span>
              </div>
              <p className="panel-description">
                Your answer becomes a message in the conversation. Skipped
                questions stay private.
              </p>
              {waiting.length ? (
                waiting.map((q) => (
                  <QuestionForm
                    key={q.id}
                    question={q}
                    pending={pending}
                    onReview={(answer) =>
                      startTransition(async () => {
                        const result = isDemo
                          ? updateDemo((s) =>
                              moderateDemo(s, group, q.id, answer),
                            )
                          : await moderateQuestion(q.id, answer);
                        setNotice(
                          result.ok
                            ? answer === null
                              ? "Question skipped."
                              : "Answer published in the conversation."
                            : result.message,
                        );
                        if (result.ok && !isDemo) router.refresh();
                      })
                    }
                  />
                ))
              ) : (
                <div className="small-empty">
                  <h3>You’re all caught up.</h3>
                  <p>New questions from members will appear here.</p>
                </div>
              )}
            </section>
            <section className="surface compose-panel">
              <PenLine size={21} />
              <h2>Keep the conversation going.</h2>
              <p className="panel-description">
                Post as {user.display_name}. Only this circle’s creators can
                publish here.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const content = String(new FormData(form).get("message"));
                  startTransition(async () => {
                    const result = isDemo
                      ? updateDemo((s) => postDemo(s, group, content))
                      : await postMessage(group.id, content);
                    setNotice(
                      result.ok ? "Message published." : result.message,
                    );
                    if (result.ok) {
                      form.reset();
                      if (!isDemo) router.refresh();
                    }
                  });
                }}
              >
                <label>
                  Your message
                  <textarea
                    name="message"
                    placeholder="What’s happening in your world?"
                    rows={7}
                    required
                    maxLength={2000}
                  />
                </label>
                <button className="button primary" disabled={pending}>
                  Publish message <ArrowUpRight size={16} />
                </button>
              </form>
              <p className="fine-print">
                Visible to everyone reading this circle.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
function QuestionForm({
  question,
  pending,
  onReview,
}: {
  question: Question;
  pending: boolean;
  onReview: (answer: string | null) => void;
}) {
  return (
    <form
      className="question-review"
      onSubmit={(e) => {
        e.preventDefault();
        onReview(String(new FormData(e.currentTarget).get("answer")));
      }}
    >
      <span className="question-caption">A READER ASKS</span>
      <h3>{question.content}</h3>
      <label>
        <span className="sr-only">Answer to {question.content}</span>
        <textarea
          name="answer"
          placeholder="Write your answer…"
          required
          maxLength={1400}
          rows={3}
        />
      </label>
      <div className="inline-actions">
        <button className="button primary" disabled={pending}>
          Publish answer
        </button>
        <button
          type="button"
          className="text-button muted"
          disabled={pending}
          onClick={() => onReview(null)}
        >
          Skip question
        </button>
      </div>
    </form>
  );
}
