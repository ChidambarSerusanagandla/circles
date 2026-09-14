import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import "./globals.css";
import "./participation.css";
import { DemoProvider } from "@/components/demo-provider";
import { DEMO_MODE } from "@/lib/config";
export const metadata: Metadata = { title: { default: "Circles — good conversations, worth following", template: "%s · Circles" }, description: "Discover the group conversations you wish you were a fly on the wall for. Read, react, and find your circles." };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><a href="#main" className="skip-link">Skip to content</a><DemoProvider><Navigation/><main id="main">{children}</main></DemoProvider><footer className="footer"><span>circles. <span className="muted">A little more conversation.</span></span><span>{DEMO_MODE ? "Demo content · Browser-local activity" : "Made for curious people"}</span></footer></body></html>; }
