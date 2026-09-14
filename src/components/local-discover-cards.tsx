"use client";
import { useDemo } from "./demo-provider";
import { ConversationCard } from "./conversation-card";
import { PreviewImpression } from "./analytics-provider";
export function LocalDiscoverCards({
  category,
  length,
}: {
  category?: string;
  length: number;
}) {
  const { state, isDemo } = useDemo();
  if (!isDemo) return null;
  return state.groups
    .filter((g) => !category || g.category === category)
    .map((group) => (
      <PreviewImpression key={group.id} groupId={group.id}>
        <ConversationCard
          group={{
            ...group,
            is_demo: true,
          }}
          length={length}
        />
      </PreviewImpression>
    ));
}
export function DiscoverCount({
  count,
  category,
}: {
  count: number;
  category?: string;
}) {
  const { state, isDemo } = useDemo();
  const total =
    count +
    (isDemo
      ? state.groups.filter((g) => !category || g.category === category).length
      : 0);
  return (
    <span className="muted">
      {total} {total === 1 ? "conversation" : "conversations"}
    </span>
  );
}
