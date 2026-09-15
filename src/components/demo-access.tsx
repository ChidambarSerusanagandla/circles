"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInDemo } from "@/lib/auth/demo-client";
import type { DemoAccount } from "@/lib/auth/demo-accounts";
export function DemoAccess({ internal = false }: { internal?: boolean }) {
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  function login(account: DemoAccount, key?: string) {
    start(async () => {
      const r = await signInDemo(account, key);
      setNotice(r.message);
      if (r.ok) {
        router.push(
          internal
            ? "/internal/growth"
            : account === "creator"
              ? "/creator"
              : "/profile",
        );
        router.refresh();
      }
    });
  }
  return (
    <div className="page account-page">
      <div className="page-heading">
        <span className="eyebrow">
          {internal ? "INTERNAL PLATFORM" : "REVIEW ACCOUNTS"}
        </span>
        <h1>{internal ? "Internal access" : "Explore each perspective."}</h1>
        <p>
          {internal
            ? "Use the access key configured by the project owner."
            : "These accounts use browser-local activity so you can review the product."}
        </p>
      </div>
      <section className="surface auth-card">
        {internal ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login(
                "internal",
                String(new FormData(e.currentTarget).get("key")),
              );
            }}
          >
            <label>
              Internal access key
              <input
                name="key"
                type="password"
                autoComplete="off"
                required
                minLength={24}
              />
            </label>
            <button disabled={pending} className="button primary">
              Open internal workspace
            </button>
            <p className="fine-print">
              No default key is provided. Set DEMO_INTERNAL_ACCESS_KEY on the
              server.
            </p>
          </form>
        ) : (
          <>
            <button
              className="button primary"
              disabled={pending}
              onClick={() => login("owner")}
            >
              Project owner · Chidambar
            </button>
            <button
              className="button"
              disabled={pending}
              onClick={() => login("reader")}
            >
              Reader · Alex
            </button>
            <button
              className="button"
              disabled={pending}
              onClick={() => login("creator")}
            >
              Creator · Rahul
            </button>
            <p className="fine-print">
              Creator access covers each person’s circles only. Internal
              platform access is separate.
            </p>
            <button
              className="button"
              disabled={pending}
              onClick={() => login("priya")}
            >
              Collaborator · Priya
            </button>
            <button
              className="button"
              disabled={pending}
              onClick={() => login("arjun")}
            >
              Collaborator · Arjun
            </button>
          </>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
}
