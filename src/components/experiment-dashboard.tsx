"use client";
import { useState } from "react";
import { ArrowUpRight, FlaskConical, Info } from "lucide-react";
import { funnels, lift, percent, rate, type Funnel } from "@/lib/analytics/metrics";
import { sampleEvents } from "@/lib/analytics/sample";
import type { Variant } from "@/lib/types";
import { useDemo } from "./demo-provider";

const simulated = funnels(sampleEvents(), true);
export function ExperimentDashboard({ measured, variant }: { measured: Funnel[]; variant: Variant }) {
  const { state, isDemo } = useDemo();
  const [source, setSource] = useState<"sample" | "activity">(isDemo ? "sample" : "activity");
  const rows = source === "sample" ? simulated : isDemo ? funnels(state.events, true) : measured;
  const [a, b] = rows;
  const change = lift(a, b);
  const enough = a.visitors > 0 && b.visitors > 0;
  return <div className="page experiment-page">
    <div className="dashboard-heading"><div className="page-heading"><span className="eyebrow">LEARNING WHAT MAKES PEOPLE STAY</span><h1>A little more context?</h1><p>One question. Two previews. A clearer way to learn.</p></div><span className="experiment-icon"><FlaskConical size={29}/></span></div>
    <section className="experiment-brief surface"><div><span className="demo-label">Conversation Preview Length</span><h2>Does a longer preview lead to more joins?</h2><p>Eight messages may give readers enough context to find a circle they want to join. Four messages may leave them more curious to open it.</p></div><div className="experiment-settings"><span>Primary metric<strong>Preview → Join</strong></span><span>Assignment<strong>50 / 50 · Per browser</strong></span><span>Conversion window<strong>7 days after a preview</strong></span></div></section>
    <div className="report-toolbar"><div className="report-tabs" aria-label="Report data source"><button aria-pressed={source === "sample"} onClick={() => setSource("sample")}>Demo data</button><button aria-pressed={source === "activity"} onClick={() => setSource("activity")}>{isDemo ? "This browser" : "Measured traffic"}</button></div><span className="muted">{source === "sample" ? "Simulated history · Sep 10, 2026" : isDemo ? `Local demo activity · Your variant: ${variant}` : "Observed events · All time"}</span></div>
    <p className="report-disclosure"><Info size={16}/>{source === "sample" ? "Demo data: these visitors and outcomes were generated to demonstrate the report. They are not real experiment results." : isDemo ? "Actions in this browser only. Demo accounts and repeat visits share one visitor identity. This is not production traffic." : "First-party events recorded by this installation. Simulated seed history is excluded."}</p>
    <div className="variant-grid">{rows.map(row => <section className={`variant-card variant-${row.variant}`} key={row.variant}><div className="variant-heading"><span className="variant-letter">{row.variant}</span><div><h2>{row.variant === "A" ? "A quick glimpse" : "A little more of the story"}</h2><p>{row.variant === "A" ? "4" : "8"}-message preview</p></div></div><div className="primary-rate"><strong>{percent(rate(row.joins, row.visitors))}</strong><span>preview → join conversion</span></div><div className="rate-track" role="img" aria-label={`${percent(rate(row.joins, row.visitors))} joined`}><span style={{ width: `${rate(row.joins, row.visitors) * 100}%` }}/></div><dl className="variant-numbers"><div><dt>Visitors</dt><dd>{row.visitors.toLocaleString()}</dd></div><div><dt>Group opens</dt><dd>{row.opens.toLocaleString()}</dd></div><div><dt>Joins</dt><dd>{row.joins.toLocaleString()}</dd></div></dl><div className="variant-secondary"><span>Preview → Open</span><strong>{percent(rate(row.opens, row.visitors))}</strong></div></section>)}</div>
    <section className="lift-panel"><div><span>Absolute lift · B vs A</span><strong>{enough ? `${change.absolute >= 0 ? "+" : ""}${(change.absolute * 100).toFixed(1)} pp` : "—"}</strong></div><div><span>Relative lift · B vs A</span><strong>{enough && change.relative !== null ? `${change.relative >= 0 ? "+" : ""}${percent(change.relative)}` : "—"}</strong></div><p><ArrowUpRight size={20}/>{source === "sample" ? "B leads in this simulation. No real-world winner." : "Early directional result — more data required."}</p></section>
    <div className="method-grid"><section><h2>What counts?</h2><p>A preview is seen when at least half of a fixed 64px area at its start is visible for one second in an active tab. Both variants use exactly the same rule.</p><p>Each browser counts once per variant. Opens and joins must follow a preview of the same circle within seven days. Repeated events do not create extra converted visitors.</p></section><section><h2>Read the result carefully.</h2><p>No statistical significance test is implemented. These rates and lifts describe the observed cohort; they do not establish a winner.</p><p>Recent visitors have not had their full seven days to join. Let cohorts mature, check the allocation, and measure repeat engagement before deciding to ship a variant. Clearing cookies creates a new visitor.</p></section></div>
  </div>;
}
