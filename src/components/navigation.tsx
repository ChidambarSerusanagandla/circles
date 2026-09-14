"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  UsersRound,
  FlaskConical,
  LayoutDashboard,
  CircleUserRound,
} from "lucide-react";
const links = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/my-groups", label: "My Groups", icon: UsersRound },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/admin", label: "Admin", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
];
export function Navigation() {
  const pathname = usePathname();
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
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "nav-link active" : "nav-link"}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link
          href="/profile"
          className="header-profile"
          aria-label="Open profile"
        >
          <CircleUserRound size={24} />
        </Link>
      </div>
    </header>
  );
}
