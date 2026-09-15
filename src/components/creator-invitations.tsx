"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Group } from "@/lib/types";
import type { InvitationView } from "@/lib/creators/types";
import { respondCreatorInvitation } from "@/app/creator/invitation-actions";
import { demoPeople, respondDemoInvitation } from "@/lib/creators/demo";
import { useDemo, updateDemo } from "./demo-provider";
export function CreatorInvitations({
  invitations,
  groups,
}: {
  invitations: InvitationView[];
  groups: Group[];
}) {
  const { state, isDemo } = useDemo();
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const rows = isDemo
    ? (state.creatorInvitations || [])
        .filter(
          (i) => i.invitee_id === state.user?.id && i.status === "pending",
        )
        .map((i) => ({
          ...i,
          group_name:
            [...groups, ...state.groups].find((g) => g.id === i.group_id)
              ?.name || "Group",
          inviter: demoPeople.find((p) => p.id === i.inviter_id),
        }))
    : invitations;
  if (!rows.length && !notice) return null;
  return (
    <section className="library-section invitation-section">
      <h2>
        Creator invitations <span>{rows.length}</span>
      </h2>
      {rows.map((i) => (
        <article key={i.id} className="surface creator-invitation">
          <div>
            <h3>{i.group_name}</h3>
            <p>
              {i.inviter?.display_name || "A creator"} invited you to create
              conversations together.
            </p>
          </div>
          <div className="inline-actions">
            {[true, false].map((accept) => (
              <button
                key={String(accept)}
                className={accept ? "button primary" : "button"}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = isDemo
                      ? updateDemo((s) =>
                          respondDemoInvitation(s, i.id, accept),
                        )
                      : await respondCreatorInvitation(i.id, accept);
                    setNotice(
                      result.ok
                        ? accept
                          ? "Invitation accepted. Your group is ready to manage below."
                          : "Invitation declined."
                        : result.message,
                    );
                    if (result.ok) router.refresh();
                  })
                }
              >
                {accept ? "Accept invitation" : "Decline invitation"}
              </button>
            ))}
          </div>
        </article>
      ))}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
