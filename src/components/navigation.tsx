"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, UsersRound, CircleUserRound, Mail } from "lucide-react";
const links = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/groups", label: "Groups", icon: UsersRound },
  { href: "/inbox", label: "Inbox", icon: Mail },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
];
export function Navigation() {
  const path = usePathname();
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Circles home">
          <span className="brand-mark">
            c<span />
          </span>
          circles<span className="brand-period">.</span>
        </Link>
        <nav className="nav" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              path === href || (href === "/groups" && path === "/creator");
            return (
              <Link
                key={href}
                href={href}
                className={active ? "nav-link active" : "nav-link"}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="header-spacer" aria-hidden="true" />
      </div>
    </header>
  );
}
