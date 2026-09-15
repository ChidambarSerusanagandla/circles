import { describe, expect, it } from "vitest";
import { createDemo, initialDemo, postDemo } from "../../src/lib/demo";
import { demoAccounts } from "../../src/lib/auth/demo-accounts";
import {
  applyDemoGroup,
  inviteDemoCreator,
  respondDemoInvitation,
} from "../../src/lib/creators/demo";
function setup() {
  const state = createDemo(
    { ...initialDemo, user: demoAccounts.owner.user },
    {
      name: "After Hours Club",
      slug: "after-hours-club",
      description: "Four people and a very long conversation.",
      category: "Friendship",
    },
  );
  return { state, group: state.groups[0] };
}
describe("creator collaboration in the browser demo", () => {
  it("creates an owner group and supports three accepted collaborators", () => {
    const created = setup();
    let state = created.state;
    for (const handle of ["rahul", "alex", "priya"])
      state = inviteDemoCreator(state, created.group, handle);
    expect(applyDemoGroup(state, created.group).admins).toHaveLength(1);
    expect(state.creatorInvitations).toHaveLength(3);
    for (const account of ["creator", "reader", "priya"] as const) {
      state = { ...state, user: demoAccounts[account].user };
      const invitation = state.creatorInvitations!.find(
        (i) => i.invitee_id === state.user!.id,
      )!;
      state = respondDemoInvitation(state, invitation.id, true);
      state = postDemo(
        state,
        applyDemoGroup(state, created.group),
        "Glad to be here.",
      );
      expect(demoAccounts[account].internal).toBe(false);
    }
    expect(applyDemoGroup(state, created.group).admins).toHaveLength(4);
    expect(state.messages).toHaveLength(3);
    expect(created.group.created_by).toBe(demoAccounts.owner.user.id);
  });
  it("keeps pending and declined invitees out of the creator conversation", () => {
    const { state: initial, group } = setup();
    const invited = inviteDemoCreator(initial, group, "@alex");
    const reader = { ...invited, user: demoAccounts.reader.user };
    expect(() =>
      postDemo(reader, applyDemoGroup(reader, group), "Cannot post yet."),
    ).toThrow("creators");
    const declined = respondDemoInvitation(
      reader,
      reader.creatorInvitations![0].id,
      false,
    );
    expect(applyDemoGroup(declined, group).admins).toHaveLength(1);
    expect(() =>
      postDemo(declined, applyDemoGroup(declined, group), "Still cannot post."),
    ).toThrow("creators");
  });
  it("only lets the invitee respond, once", () => {
    const { state, group } = setup();
    const invited = inviteDemoCreator(state, group, "alex"),
      id = invited.creatorInvitations![0].id;
    expect(() => respondDemoInvitation(invited, id, true)).toThrow(
      "unavailable",
    );
    const accepted = respondDemoInvitation(
      { ...invited, user: demoAccounts.reader.user },
      id,
      true,
    );
    expect(() => respondDemoInvitation(accepted, id, true)).toThrow("already");
  });
  it("requires creator access and rejects duplicate or unknown invitees", () => {
    const { state, group } = setup();
    expect(() =>
      inviteDemoCreator(
        { ...state, user: demoAccounts.reader.user },
        group,
        "priya",
      ),
    ).toThrow("creators");
    expect(() => inviteDemoCreator(state, group, "nobody_here")).toThrow(
      "No account",
    );
    expect(() => inviteDemoCreator(state, group, "chidambar")).toThrow(
      "already",
    );
    expect(() =>
      inviteDemoCreator(inviteDemoCreator(state, group, "alex"), group, "alex"),
    ).toThrow("pending");
  });
});
