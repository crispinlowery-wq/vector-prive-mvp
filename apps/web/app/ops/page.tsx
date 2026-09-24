"use client";

import { Status } from "@/components/Status";
import { accessMetrics, accessOpportunities } from "@/lib/accessOS";
import { requests } from "@/lib/data";
import { loadRequests } from "@/lib/requestStore";
import { type RequestItem } from "@/lib/data";
import { ArrowUpRight, CheckCircle2, Clock3, Crown, Inbox, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function Dashboard() {
  const [items, setItems] = useState<RequestItem[]>(requests);

  useEffect(() => {
    const sync = () => setItems(loadRequests());
    sync();
    window.addEventListener("vector-prive-requests-updated", sync);
    return () => window.removeEventListener("vector-prive-requests-updated", sync);
  }, []);

  const stats = useMemo(() => ({
    open: items.filter((request) => !["approved", "confirmed"].includes(request.status)).length,
    approvals: items.filter((request) => request.status === "awaiting_approval").length,
    accepted: items.filter((request) => ["approved", "confirmed", "in_progress"].includes(request.status)).length,
  }), [items]);
  const access = accessMetrics();

  return <div className="content">
    <div className="page-heading">
      <div><p className="eyebrow">TUESDAY, 7 JULY</p><h1>Good afternoon, Crispin.</h1><p>Here’s what needs your judgement today.</p></div>
      <Link className="primary" href="/ops/requests">Open request inbox <ArrowUpRight size={17}/></Link>
    </div>
    <div className="metrics">
      <div><span className="metric-icon gold"><Inbox/></span><p>Open requests</p><strong>{stats.open}</strong><small><b>{items.filter((request) => request.received === "Just now").length}</b> new from member portal</small></div>
      <div><span className="metric-icon coral"><TriangleAlert/></span><p>Needs approval</p><strong>{stats.approvals}</strong><small>Human review gate active</small></div>
      <div><span className="metric-icon green"><Clock3/></span><p>Median response</p><strong>18m</strong><small><b>↓ 6m</b> this week</small></div>
      <div><span className="metric-icon blue"><Sparkles/></span><p>Useful AI drafts</p><strong>92%</strong><small>{stats.accepted} accepted or in motion</small></div>
    </div>
    <section className="access-strip">
      <div>
        <p className="eyebrow">ACCESS OS</p>
        <h2>Proactive moments worth opening the app for.</h2>
        <p>Inspired by the best consumer concierge products, but built as an operator-grade access engine.</p>
      </div>
      <div className="access-strip-metrics">
        <span><Crown/> {access.readyToPitch} ready to pitch</span>
        <span><Sparkles/> {access.dailyMoments} daily moments</span>
      </div>
      <Link href="/ops/access">Open Access OS <ArrowUpRight size={15}/></Link>
    </section>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-head"><div><h2>Priority queue</h2><p>Ordered by urgency and client impact</p></div><Link href="/ops/requests">View all</Link></div>
        <div className="queue">{items.slice(0, 4).map((request) => <Link href={`/ops/requests?id=${request.id}`} key={request.id} className="queue-row">
          <div className="avatar">{request.initials}</div>
          <div className="queue-main"><div><strong>{request.title}</strong><Status value={request.status}/></div><p>{request.client} · {request.category}</p></div>
          <div className={`urgency ${request.urgency}`}>{request.urgency}</div>
          <time>{request.received}</time>
        </Link>)}</div>
      </section>
      <aside className="panel activity">
        <div className="panel-head"><div><h2>Service pulse</h2><p>Last 24 hours</p></div></div>
        <div className="pulse"><div className="ring"><strong>94</strong><small>QUALITY</small></div><p>“Handled without chasing”</p></div>
        <ul><li><CheckCircle2/>11 requests confirmed <time>Today</time></li><li><Sparkles/>8 AI drafts accepted <time>92%</time></li><li><Clock3/>1 SLA approaching <time>12 min</time></li></ul>
      </aside>
    </div>
    <section className="panel access-preview-panel">
      <div className="panel-head"><div><h2>Access radar preview</h2><p>Luxury is increasingly proactive: spot the occasion, prove the access, then ask for approval.</p></div><Link href="/ops/access">View system</Link></div>
      <div className="access-preview-list">
        {accessOpportunities.slice(0, 3).map((item) => <article key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.client} · {item.category} · {item.confidence}% fit</span>
          <p>{item.recommendedMove}</p>
        </article>)}
      </div>
    </section>
  </div>;
}
