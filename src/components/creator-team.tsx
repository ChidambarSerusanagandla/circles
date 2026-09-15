"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Group } from "@/lib/types";
import { inviteCreator } from "@/app/creator/invitation-actions";
import { inviteDemoCreator } from "@/lib/creators/demo";
import { useDemo, updateDemo } from "./demo-provider";
import { Avatar } from "./avatar";
export function CreatorTeam({ group }: { group: Group }) {
  const { isDemo } = useDemo();
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section className="surface creator-team">
      <div className="section-heading">
        <h2>The people behind it</h2>
        <span className="count-badge">
          {group.admins.length}{" "}
          {group.admins.length === 1 ? "creator" : "creators"}
        </span>
      </div>
      <ul className="creator-people">
        {group.admins.map((p) => (
          <li key={p.id}>
            <Avatar person={p} small />
            <div>
              <strong>{p.display_name}</strong>
              <span className="muted">
                {group.created_by === p.id ? "Owner · Creator" : "Creator"}
                {p.handle ? ` · @${p.handle}` : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="creator-invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const handle = String(new FormData(form).get("handle"));
          start(async () => {
            const result = isDemo
              ? updateDemo((s) => inviteDemoCreator(s, group, handle))
              : await inviteCreator(group.id, handle);
            setNotice(
              result.ok
                ? "Invitation sent. They can accept or decline from Groups."
                : result.message,
            );
            if (result.ok) {
              form.reset();
              router.refresh();
            }
          });
        }}
      >
        <label>
          Invite a creator by handle
          <input
            name="handle"
            placeholder="@priya"
            required
            maxLength={31}
            autoComplete="off"
          />
        </label>
        <button className="button" disabled={pending}>
          Send creator invitation
        </button>
      </form>
      <p className="fine-print">
        Bring your people into the conversation. Invite each person by their
        existing handle; they become a creator only after accepting. You can
        invite three or more people.
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
