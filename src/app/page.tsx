import {
  DiscoverCount,
  LocalDiscoverCards,
} from "@/components/local-discover-cards";
import { ArrowDown, Sparkles } from "lucide-react";
import { categories } from "@/lib/seed-data";
import { ConversationCard } from "@/components/conversation-card";
import Link from "next/link";
import {
  AnalyticsProvider,
  PageEvent,
  PreviewImpression,
} from "@/components/analytics-provider";
import { getAssignment } from "@/lib/experiments/server";
import { previewLength } from "@/lib/experiments/assignment";
import { getGroups } from "@/lib/data";
export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const assignment = await getAssignment();
  const length = previewLength(assignment.displayVariant ?? assignment.variant);
  const groups = (await getGroups()).filter(
    (g) => !category || g.category === category,
  );
  return (
    <AnalyticsProvider assignment={assignment}>
      <div className="page discover">
        <PageEvent name="discover_viewed" />
        <section className="discover-intro">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              THE GOOD PART IS THE CONVERSATION
            </div>
            <h1>
              Find your kind
              <br />
              of <span>conversation.</span>
            </h1>
            <p>
              Discover interesting groups by reading their conversations.
              <br className="desktop-br" /> Inside jokes, big questions, and a
              seat for you.
            </p>
          </div>
          <div className="intro-note">
            <span className="note-icon">
              <Sparkles size={22} />
            </span>
            <strong>A window into their world.</strong>
            <p>
              Read along. React. Stay a while.
              <br />
              No introduction needed.
            </p>
            <span className="note-bottom">
              Your next rabbit hole starts here <ArrowDown size={15} />
            </span>
          </div>
        </section>
        <section aria-label="Discover conversations">
          <div className="feed-toolbar">
            <div className="category-tabs">
              <Link
                href="/"
                aria-current={!category ? "page" : undefined}
                className={!category ? "filter selected" : "filter"}
              >
                For you
              </Link>
              {categories.map((c) => (
                <Link
                  href={`/?category=${c}`}
                  key={c}
                  aria-current={category === c ? "page" : undefined}
                  className={category === c ? "filter selected" : "filter"}
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
          <div className="feed-caption">
            <span>
              <strong>{category || "Worth a read"}</strong>
              <span className="muted"> · A few circles to get you started</span>
            </span>
            <DiscoverCount count={groups.length} category={category} />
          </div>
          {groups.length ? (
            <div className="conversation-grid">
              {groups.map((group) => (
                <PreviewImpression key={group.id} groupId={group.id}>
                  <ConversationCard group={group} length={length} />
                </PreviewImpression>
              ))}
              <LocalDiscoverCards category={category} length={length} />
            </div>
          ) : (
            <div className="empty">
              <h2>No conversations here yet.</h2>
              <Link href="/">Explore all circles</Link>
            </div>
          )}
        </section>
        <div className="feed-end">
          <span className="mini-mark">c.</span>
          <p>Good conversations don’t need a camera.</p>
          <span>
            You’ve reached the end. A new perspective might be one scroll up.
          </span>
        </div>
      </div>
    </AnalyticsProvider>
  );
}
