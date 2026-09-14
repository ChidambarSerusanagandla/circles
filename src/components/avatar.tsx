import type { Profile } from "@/lib/types";
export function Avatar({
  person,
  small = false,
}: {
  person: Profile;
  small?: boolean;
}) {
  const tone = parseInt(person.id.slice(-2), 16) % 6;
  return (
    <span
      role="img"
      className={`avatar tone-${tone} ${small ? "avatar-sm" : ""}`}
      aria-label={person.display_name}
    >
      {person.display_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function AvatarStack({ people }: { people: Profile[] }) {
  return (
    <div className="avatar-stack">
      {people.map((person) => (
        <Avatar key={person.id} person={person} small />
      ))}
    </div>
  );
}
