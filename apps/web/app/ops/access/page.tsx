"use client";

import { accessMetrics, accessOpportunities, accessSuppliers, passionProfiles, type AccessOpportunity } from "@/lib/accessOS";
import { ArrowUpRight, BadgeCheck, BrainCircuit, CalendarClock, Crown, Gem, HeartHandshake, Radar, Sparkles, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";

const categoryIcon = {
  Travel: Radar,
  Dining: Gem,
  Entertainment: Trophy,
  "Luxury goods": Crown,
  Wellbeing: HeartHandshake,
  Family: UsersRound,
};

export default function AccessOSPage() {
  const metrics = accessMetrics();

  return <div className="content access-os-page">
    <div className="access-hero">
      <div>
        <p className="eyebrow">ACCESS OS</p>
        <h1>Proactive luxury, before the client asks.</h1>
        <p>Daily-use concierge intelligence across travel, dining, entertainment, luxury goods, wellbeing and family life — with human approval and supplier proof built in.</p>
      </div>
      <aside>
        <span><Sparkles/>Velocity Black lesson absorbed</span>
        <b>Time + access + taste</b>
        <p>Vector Privé turns that into an operator-grade system of record.</p>
      </aside>
    </div>

    <div className="access-metrics">
      <Metric label="Daily moments" value={metrics.dailyMoments} detail="Proactive opportunities"/>
      <Metric label="Ready to pitch" value={metrics.readyToPitch} detail="No booking commitment"/>
      <Metric label="Supplier checks" value={metrics.supplierChecks} detail="Needs access proof"/>
      <Metric label="Passion coverage" value={`${metrics.passionCoverage}%`} detail="Profiles mapped"/>
    </div>

    <div className="access-grid">
      <section className="access-panel access-opportunities">
        <div className="access-panel-head">
          <div><h2>Access radar</h2><p>Ranked moments where Vector Privé can create time, access or emotional memory.</p></div>
          <Link href="/ops/requests">Open inbox <ArrowUpRight size={14}/></Link>
        </div>
        <div className="access-opportunity-list">
          {accessOpportunities.map((item) => <OpportunityCard key={item.id} item={item}/>)}
        </div>
      </section>

      <aside className="access-panel">
        <div className="access-panel-head"><div><h2>Passion graph</h2><p>What makes the app feel worth opening daily.</p></div></div>
        <div className="passion-list">
          {passionProfiles.map((profile) => <article key={profile.client}>
            <div><b>{profile.client}</b><span>{profile.passions.join(" · ")}</span></div>
            <p>{profile.dailyHook}</p>
            <em>{profile.nextGesture}</em>
          </article>)}
        </div>
      </aside>
    </div>

    <div className="access-grid lower">
      <section className="access-panel">
        <div className="access-panel-head"><div><h2>Supplier proof board</h2><p>Operational access beats generic recommendations.</p></div></div>
        <div className="supplier-board">
          {accessSuppliers.map((supplier) => <article key={supplier.name}>
            <span>{supplier.relationship}</span>
            <h3>{supplier.name}</h3>
            <p>{supplier.city} · {supplier.category}</p>
            <small>{supplier.responseTime}</small>
            <em>{supplier.useFor}</em>
          </article>)}
        </div>
      </section>

      <section className="access-panel operating-doctrine">
        <div className="access-panel-head"><div><h2>Operating doctrine</h2><p>How we beat a consumer concierge app.</p></div></div>
        <div className="doctrine-grid">
          <span><BrainCircuit/> AI finds the moment</span>
          <span><Radar/> Operator proves access</span>
          <span><BadgeCheck/> Human approves commitment</span>
          <span><CalendarClock/> Client gets time back</span>
        </div>
      </section>
    </div>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>;
}

function OpportunityCard({ item }: { item: AccessOpportunity }) {
  const Icon = categoryIcon[item.category];
  return <article className={`access-card ${item.status}`}>
    <div className="access-card-top">
      <span><Icon size={15}/>{item.category}</span>
      <b>{item.confidence}%</b>
    </div>
    <h3>{item.title}</h3>
    <p>{item.client} · {item.timing}</p>
    <blockquote>{item.signal}</blockquote>
    <div className="move"><strong>Recommended move</strong><span>{item.recommendedMove}</span></div>
    <div className="path"><strong>Access path</strong><span>{item.accessPath}</span></div>
  </article>;
}
