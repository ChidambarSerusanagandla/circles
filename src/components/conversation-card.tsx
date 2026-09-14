"use client";
import Link from "next/link";
import { ArrowUpRight, UsersRound } from "lucide-react";
import type { Group } from "@/lib/types";
import { AvatarStack } from "./avatar";
import { Message } from "./message";
import { useDemo } from "./demo-provider";
import { demoMemberCount, demoReactionCount } from "@/lib/demo";
import { REACTIONS } from "@/lib/types";
export function ConversationCard({
  group: baseGroup,
  length = 4,
}: {
  group: Group;
  length?: number;
}) {
  const { state, isDemo } = useDemo();
  const group = isDemo
    ? {
        ...baseGroup,
        member_count:
          baseGroup.member_count + demoMemberCount(state, baseGroup.id),
        messages: [
          ...baseGroup.messages,
          ...state.messages.filter((m) => m.group_id === baseGroup.id),
        ].map((m) => ({
          ...m,
          reactions: Object.fromEntries(
            REACTIONS.map((r) => [
              r,
              (m.reactions[r] || 0) + demoReactionCount(state, m.id, r),
            ]).filter(([, count]) => Number(count) > 0),
          ),
        })),
      }
    : baseGroup;
  return (
    <article className="conversation-card">
      <div className="card-heading">
        <div className="card-badges">
          <span className={`category category-${group.category.toLowerCase()}`}>
            {group.category}
          </span>
          <span
            className={
              group.access_type === "premium" ? "access premium" : "access"
            }
          >
            {group.access_type === "premium"
              ? `$${group.monthly_price?.toFixed(2)} / mo · Demo`
              : "Free to join"}
          </span>
        </div>
        <Link href={`/groups/${group.slug}`} className="card-title">
          <h2>{group.name}</h2>
        </Link>
        <p className="card-description">{group.description}</p>
        <div className="card-people">
          <AvatarStack people={group.admins} />
          <span>
            {group.admins.length}{" "}
            {group.admins.length === 1 ? "voice" : "voices"}
          </span>
          <span className="watchers">
            <UsersRound size={14} />
            {group.member_count.toLocaleString()} members
          </span>
        </div>
      </div>
      {group.is_demo && <span className="card-demo">Demo data</span>}
      <div className="card-conversation">
        <span
          className="preview-start"
          data-preview-observation
          aria-hidden="true"
        />
        {group.messages.slice(0, length).map((message) => (
          <Message key={message.id} message={message} compact />
        ))}
      </div>
      <Link
        href={`/groups/${group.slug}`}
        className="card-cta"
        aria-label={`Continue watching ${group.name}`}
      >
        Continue watching
        <ArrowUpRight size={18} />
      </Link>
    </article>
  );
}
