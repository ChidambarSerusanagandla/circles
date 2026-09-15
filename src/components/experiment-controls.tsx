"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { configureExperiment } from "@/app/internal/growth/actions";
export function ExperimentControls({
  status,
  isDemo,
}: {
  status: "draft" | "running" | "completed";
  isDemo: boolean;
}) {
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section className="page internal-controls">
      <div className="section-heading">
        <strong>Internal workspace · Growth</strong>
        <span className="status">Platform access</span>
      </div>
      <form
        className="inline-actions"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get("status"));
          start(async () => {
            const r = await configureExperiment(value);
            setNotice(r.message);
            if (r.ok) router.refresh();
          });
        }}
      >
        <label>
          Preview experiment
          <select key={status} name="status" defaultValue={status}>
            <option value="draft">Draft · 4-message default</option>
            <option value="running">Running · 4 vs 8 messages</option>
            <option value="completed">Completed · stop enrollment</option>
          </select>
        </label>
        <button className="button" disabled={pending}>
          Save configuration
        </button>
      </form>
      <p className="fine-print">
        {isDemo
          ? "Configuration applies to this browser’s demo only."
          : "Configuration applies to this installation."}{" "}
        Draft serves four messages. Starting resumes existing assignments; it
        does not create a new experiment.
      </p>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
    </section>
  );
}
