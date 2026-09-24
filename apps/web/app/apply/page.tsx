"use client";

import { API_BASE } from "@/lib/authClient";
import { ArrowRight, Check, Clock3, Crown, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type Tier = "vector" | "vector_plus" | "vector_prive";
const tiers: { id: Tier; name: string; price: string; summary: string; detail: string }[] = [
  { id: "vector", name: "Vector", price: "£200", summary: "Everyday travel, quietly handled.", detail: "Travel and operational details, Monday to Friday, 9am–6pm." },
  { id: "vector_plus", name: "Vector Plus", price: "£500", summary: "The world stays in motion.", detail: "24/7 support, dynamic travel planning and proactive coordination." },
  { id: "vector_prive", name: "Vector Privé", price: "£850", summary: "A private office for life.", detail: "A fully bespoke service for life’s opportunities, wrinkles and support." },
];

export default function ApplyPage() {
  const [tier, setTier] = useState<Tier>("vector_plus");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "", invite_code: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ message: string; checkout_url?: string | null; access_url?: string | null } | null>(null);
  const chosen = tiers.find((item) => item.id === tier)!;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE}/membership/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tier }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "We could not receive your application.");
      setResult(payload);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not receive your application."); }
    finally { setBusy(false); }
  }

  return <main className="apply-page">
    <header className="apply-nav"><Link href="/apply" className="wordmark">VECTOR PRIVÉ</Link><Link href="/login">Member sign in</Link></header>
    <section className="apply-intro"><p><Sparkles size={14}/>PRIVATE MEMBERSHIP</p><h1>Life, perfectly<br/><em>orchestrated.</em></h1><span>Choose the level of support that makes life feel lighter. Every membership retains human judgement and clear approval.</span></section>
    <section className="apply-shell">
      <div className="apply-steps"><span>01 · Choose membership</span><span>02 · Tell us a little</span><span>03 · Secure your place</span></div>
      <div className="tier-grid">{tiers.map((item) => <button type="button" key={item.id} className={tier === item.id ? "selected" : ""} onClick={() => setTier(item.id)}><small>{item.name === "Vector Privé" ? "BESPOKE" : "MEMBERSHIP"}</small><h2>{item.name}</h2><strong>{item.price}<i>/ month</i></strong><p>{item.summary}</p><span>{item.detail}</span><b>{tier === item.id ? <Check size={15}/> : null}</b></button>)}</div>
      {!result ? <form className="apply-form" onSubmit={submit}>
        <div><p className="eyebrow">YOUR INTRODUCTION</p><h2>Begin with the essentials.</h2><p>We will only use these details to consider your membership and set up your private profile.</p></div>
        <label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required autoComplete="name"/></label>
        <label>Email address<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email"/></label>
        <label>Mobile number <small>Optional</small><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel"/></label>
        <label className="wide">What would make Vector most useful to you? <small>Optional</small><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Travel rhythm, family logistics, a particular occasion…"/></label>
        <label className="wide invite-field"><Crown size={16}/><span>Invitation key <small>Optional</small></span><input value={form.invite_code} onChange={(e) => setForm({ ...form, invite_code: e.target.value.toUpperCase() })} placeholder="Enter your one-time key" autoCapitalize="characters"/></label>
        {error && <p className="apply-error">{error}</p>}
        <footer><span><ShieldCheck size={15}/>Secure checkout. No payment details are entered into Vector.</span><button disabled={busy}>{busy ? "Preparing…" : <>Apply for {chosen.name}<ArrowRight size={17}/></>}</button></footer>
      </form> : <section className="apply-success"><Check size={28}/><p className="eyebrow">APPLICATION RECEIVED</p><h2>{result.message}</h2>{result.access_url ? <><p>Your invitation has reserved your membership. Create your secure access now, then complete the private introduction.</p><a href={result.access_url}>Create secure access <ArrowRight size={17}/></a></> : result.checkout_url ? <><p>Your place is reserved while you complete secure monthly membership payment. Vector never handles your card details.</p><a href={result.checkout_url}>Continue to secure checkout <ArrowRight size={17}/></a></> : <><p>The Vector private office will confirm your membership and provide the secure next step shortly.</p><span><Clock3 size={16}/>Usually reviewed within one working day.</span></>}</section>}
    </section>
  </main>;
}
