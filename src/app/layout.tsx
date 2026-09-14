import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Circles — good conversations, worth following", template: "%s · Circles" }, description: "Discover the group conversations you wish you were a fly on the wall for. Read, react, and find your circles." };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><a href="#main" className="skip-link">Skip to content</a><Navigation/><main id="main">{children}</main><footer className="footer"><span>circles. <span className="muted">A little more conversation.</span></span><span>Demo content · Made for curious people</span></footer></body></html>; }
