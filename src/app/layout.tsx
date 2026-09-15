import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import "./globals.css";
import "./participation.css";
import "./dashboard.css";
import "./experiments.css";
import { getAssignment } from "@/lib/experiments/server";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { DemoProvider } from "@/components/demo-provider";
import { DEMO_MODE } from "@/lib/config";
import { getUser } from "@/lib/data";
export const metadata: Metadata = {
  title: {
    default: "Circles — good conversations, worth following",
    template: "%s · Circles",
  },
  description:
    "Discover the group conversations you wish you were a fly on the wall for. Read, react, and find your circles.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <DemoProvider user={user}>
          <AnalyticsProvider assignment={await getAssignment()}>
            <Navigation />
            <main id="main">{children}</main>
          </AnalyticsProvider>
        </DemoProvider>
        <footer className="footer">
          <span>
            circles. <span className="muted">A little more conversation.</span>
          </span>
          <span>
            {DEMO_MODE
              ? "Preview · Fictional conversations and engagement"
              : "Made for curious people"}
          </span>
        </footer>
      </body>
    </html>
  );
}
