"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, LogOut } from "lucide-react";
import type { Profile } from "@/lib/types";
import { authenticate, signOut, updateProfile } from "@/app/auth/actions";
import { signInDemo } from "@/lib/auth/demo-client";
import { useDemo } from "./demo-provider";
import { Avatar } from "./avatar";
export function ProfileView({
  user,
  next,
}: {
  user: Profile | null;
  next?: string;
}) {
  const { isDemo } = useDemo();
  const [signup, setSignup] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  function done(result: { ok: boolean; message: string }, navigate = false) {
    setNotice(result.message);
    if (result.ok) {
      if (navigate && next) router.push(next);
      router.refresh();
    }
  }
  return (
    <div className="page account-page">
      <div className="page-heading">
        <span className="eyebrow">YOUR LITTLE CORNER</span>
        <h1>
          {user
            ? "Hello, " + user.display_name.split(" ")[0] + "."
            : "Come on in."}
        </h1>
        <p>
          {user
            ? "Your circles, your curiosity, your next good read."
            : "Find a conversation you love. Make yourself part of it."}
        </p>
      </div>
      <div className="account-layout">
        <section className="surface auth-card">
          {user ? (
            <>
              <div className="profile-identity">
                <Avatar person={user} />
                <div>
                  <h2>{user.display_name}</h2>
                  <span className="muted">
                    {user.handle ? "@" + user.handle : "Your profile"}
                  </span>
                </div>
              </div>
              <form
                key={user.id + user.display_name + user.handle}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fields = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  start(async () => done(await updateProfile(fields)));
                }}
              >
                <label>
                  Display name
                  <input
                    name="display_name"
                    defaultValue={user.display_name}
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="name"
                  />
                </label>
                <label>
                  Handle
                  <input
                    name="handle"
                    defaultValue={user.handle || ""}
                    pattern="[a-zA-Z][a-zA-Z0-9_]{2,29}"
                    minLength={3}
                    maxLength={30}
                    placeholder="your_handle"
                    autoComplete="username"
                  />
                </label>
                <p className="fine-print">
                  Optional. 3–30 letters, numbers or underscores; start with a
                  letter.
                </p>
                <button disabled={pending} className="button">
                  Save profile
                </button>
              </form>
              <Link href={next || "/groups"} className="button primary">
                {next ? "Back to your conversation" : "Go to Groups"}
                <ArrowUpRight size={16} />
              </Link>
              <button
                className="button"
                disabled={pending}
                onClick={() => start(async () => done(await signOut()))}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </>
          ) : isDemo ? (
            <>
              <h2>Make yourself at home.</h2>
              <p>
                Sign in to join circles, react and ask the creators a question.
              </p>
              <button
                className="button primary"
                disabled={pending}
                onClick={() =>
                  start(async () => done(await signInDemo("owner"), true))
                }
              >
                Continue as Chidambar
              </button>
              <p className="fine-print">
                Project-owner demo account. Activity stays in this browser.
              </p>
            </>
          ) : (
            <>
              <div className="auth-tabs">
                <button
                  onClick={() => setSignup(false)}
                  aria-pressed={!signup}
                  className={!signup ? "selected" : ""}
                >
                  Sign in
                </button>
                <button
                  onClick={() => setSignup(true)}
                  aria-pressed={signup}
                  className={signup ? "selected" : ""}
                >
                  Create account
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fields = new FormData(e.currentTarget);
                  start(async () =>
                    done(
                      await authenticate(
                        {
                          email: fields.get("email"),
                          password: fields.get("password"),
                          display_name: signup
                            ? fields.get("display_name")
                            : "Reader",
                        },
                        signup,
                      ),
                      !signup,
                    ),
                  );
                }}
              >
                {signup && (
                  <label>
                    Display name
                    <input
                      name="display_name"
                      autoComplete="nickname"
                      required
                      minLength={2}
                      maxLength={60}
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={signup ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    maxLength={128}
                  />
                </label>
                <button disabled={pending} className="button primary">
                  {pending
                    ? "One moment…"
                    : signup
                      ? "Create account"
                      : "Sign in"}
                </button>
              </form>
            </>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </section>
        <aside className="account-note">
          <MessageCircle size={24} />
          <h2>Built around the conversation.</h2>
          <p>
            You can always browse without an account. Sign in when you’re ready
            to react, join a circle, or send a question.
          </p>
        </aside>
      </div>
    </div>
  );
}
