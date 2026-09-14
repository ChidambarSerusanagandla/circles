import { describe, expect, it } from "vitest";
import { askDemo, initialDemo, joinDemo, moderateDemo, postDemo, reactDemo } from "../../src/lib/demo";
import { demoGroups, profiles } from "../../src/lib/seed-data";
import { groupInput, membershipStatus } from "../../src/lib/rules";
const circle=demoGroups[0];const reader={...initialDemo,user:profiles[4]};const admin={...initialDemo,user:profiles[0]};
describe("participation rules",()=>{
  it("requires an account to join",()=>expect(()=>joinDemo(initialDemo,circle)).toThrow("sign in"));
  it("joins once even when retried",()=>{const joined=joinDemo(reader,circle);expect(joinDemo(joined,circle).memberships).toEqual([`${reader.user.id}:${circle.id}`]);});
  it("marks premium membership explicitly as a demo entitlement",()=>{expect(membershipStatus("premium")).toBe("premium_demo");expect(membershipStatus("free")).toBe("active");});
  it("toggles reactions without duplicates",()=>{const reacted=reactDemo(reader,circle.messages[0].id,"❤️");expect(reacted.reactions).toHaveLength(1);expect(reactDemo(reacted,circle.messages[0].id,"❤️").reactions).toHaveLength(0);expect(()=>reactDemo(reader,circle.messages[0].id,"wrong")).toThrow();});
  it("requires membership and meaningful question content",()=>{expect(()=>askDemo(reader,circle.id,"What happened?")).toThrow("Join");expect(()=>askDemo(joinDemo(reader,circle),circle.id," ")).toThrow();expect(askDemo(joinDemo(reader,circle),circle.id,"How did you meet?").questions).toHaveLength(3);});
  it("allows only that circle’s creators to publish",()=>{expect(()=>postDemo(reader,circle,"Hello")).toThrow("creators");expect(postDemo(admin,circle,"Hello").messages).toHaveLength(1);expect(()=>postDemo(admin,demoGroups[1],"Hello")).toThrow("creators");});
  it("publishes a question answer exactly once",()=>{const id=initialDemo.questions[0].id;const answered=moderateDemo(admin,circle,id,"About three years!");expect(answered.questions[0].status).toBe("answered");expect(answered.messages[0].content).toContain("three years");expect(()=>moderateDemo(answered,circle,id,"Again")).toThrow("already");});
  it("skips a question without publishing a message",()=>{const next=moderateDemo(admin,circle,initialDemo.questions[0].id,null);expect(next.questions[0].status).toBe("skipped");expect(next.messages).toHaveLength(0);});
  it("validates a circle’s title, address, category and description",()=>{const valid={name:"New Circle",slug:"new-circle",description:"A thoughtful place to talk.",category:"Career"};expect(groupInput.safeParse(valid).success).toBe(true);for(const change of [{name:" "},{slug:"../../admin"},{description:"short"},{category:"Invalid"}])expect(groupInput.safeParse({...valid,...change}).success).toBe(false);});
});
