"use client";

import { apiFetch, ensureSession, getSession } from "@/lib/authClient";
import {
  ArrowRight,
  Car,
  Check,
  Clock3,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const categories = [
  { label: "Travel", icon: Plane },
  { label: "Dining", icon: Utensils },
  { label: "Transport", icon: Car },
];

const serviceTiles = [
  { label: "Travel, considered", detail: "Routes, rooms and moments that fit", icon: Plane },
  { label: "Tables, held lightly", detail: "The right setting, confirmed by a human", icon: Utensils },
  { label: "The details in motion", detail: "Transfers, homes and the work around life", icon: Car },
];

export default function Member() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("Travel");
  const [request, setRequest] = useState("We’re thinking of Kyoto for half-term. Four of us, somewhere serene, and something special for the children.");
  const [memberName, setMemberName] = useState("Amelia");
  const [memberInitials, setMemberInitials] = useState("AH");
  const [memberPhoto, setMemberPhoto] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  useEffect(() => {
    void ensureSession().then(async (user) => {
      if (!user || !user.client_id) return;
      setMemberName(user.full_name.split(/\s+/)[0] || user.full_name);
      setMemberInitials(user.full_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase());
      const profile = await apiFetch<{ profile_photo_data_url?: string | null }>("/onboarding").catch(() => null);
      setMemberPhoto(profile?.profile_photo_data_url || null);
    });
  }, []);

  async function submitRequest() {
    const text = request.trim();
    if (!text) return;
    if (!getSession() && !await ensureSession()) { router.push("/login"); return; }
    setError("");
    try {
      await apiFetch("/requests", { method: "POST", body: JSON.stringify({ title: `${category} concierge request`, message: text, category: category.toLowerCase(), channel: "web" }) });
      setSent(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not submit the request."); }
  }

  async function submitFeedback() {
    if (feedback.trim().length < 3) return;
    if (!getSession() && !await ensureSession()) { router.push("/login"); return; }
    setFeedbackStatus("Saving securely…");
    try {
      const result = await apiFetch<{ message: string }>("/preferences/feedback", { method: "POST", body: JSON.stringify({ note: feedback.trim() }) });
      setFeedback("");
      setFeedbackStatus(result.message);
    } catch (caught) {
      setFeedbackStatus(caught instanceof Error ? caught.message : "We could not save your feedback.");
    }
  }

  return <div className="member-page">
    <header className="member-nav">
      <Link href="/" className="brand light logo-brand" aria-label="Vector Privé">
        <span className="wordmark member-wordmark">VECTOR PRIVÉ</span>
      </Link>
      <div><Link href="/onboarding" className="member-chip" aria-label="Edit your profile">{memberPhoto ? <img src={memberPhoto} alt=""/> : memberInitials}</Link><span>Good evening, {memberName}</span><Link href="/approvals">Approvals</Link><Link href="/trust">Trust centre</Link><Link href="/onboarding">My profile</Link></div>
    </header>

    <section className="member-hero atelier-hero">
      <div className="atelier-image" aria-hidden="true"/>
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={14}/>Your private lifestyle office</div>
        <h1>One message.<br/><em>Consider it handled.</em></h1>
        <p>Vector quietly coordinates travel, dining, homes and everything around a life in motion. Thoughtful options, a human point of view, and clear approval before anything consequential happens.</p>

        <div className="composer">
          <textarea id="request" value={request} onChange={(event) => setRequest(event.target.value)}/>
          <div className="composer-bottom"><div>
            {categories.map(({ label, icon: Icon }) => <button key={label} onClick={() => setCategory(label)} className={category === label ? "active" : ""}><Icon size={12}/>{label}</button>)}
            <button>Flexible dates</button>
          </div><button className="send" onClick={submitRequest}>{sent ? <><Check size={18}/>Received</> : <>Send request<ArrowRight size={18}/></>}</button></div>
        </div>
        {error && <div className="partner-message error">{error}</div>}

        <div className="trust"><span><ShieldCheck/>Human judgement, always</span><span><Clock3/>Prepared before you need to ask</span><span><MessageCircle/>WhatsApp or web</span></div>
      </div>
    </section>

    <section className="service-canvas">
      <div className="canvas-heading"><small>THE VECTOR WAY</small><h2>A private office shaped around your life.</h2><p>You should not need to repeat yourself, chase an update, or sort through a dozen options.</p></div>
      <div className="service-tiles">
        {serviceTiles.map(({ label, detail, icon: Icon }) => <article key={label}>
          <span><Icon size={18}/></span>
          <h3>{label}</h3>
          <p>{detail}</p>
        </article>)}
      </div>
    </section>

    <section className="service-principles">
      <article><small>01</small><h2>Tell us once.</h2><p>Your preferences, practicalities and feedback are treated as context, not a questionnaire you have to repeat.</p></article>
      <article><small>02</small><h2>We make the work invisible.</h2><p>Vector researches, coordinates and verifies the detail, bringing only considered choices back to you.</p></article>
      <article><small>03</small><h2>You stay in control.</h2><p>No booking, payment or consequential decision is made without the right authority and a clear record.</p></article>
    </section>

    <section className="learning-feedback">
      <div><small>PRIVATE PROFILE LEARNING</small><h2>Help Vector remember what matters.</h2><p>Share feedback from a trip or service experience. Explicit preferences are saved with their source and used in future suggestions.</p></div>
      <div><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="For example: We loved the intimate hotel, but next time we would prefer somewhere quieter…"/><button onClick={submitFeedback} disabled={feedback.trim().length < 3}>Save to my profile</button>{feedbackStatus && <span>{feedbackStatus}</span>}</div>
    </section>

    <section className="member-status">
      <div><small>IN MOTION</small><h2>Your world, quietly coordinated.</h2></div>
      <div className="journey-card"><span className="journey-icon">京</span><div><small>TRAVEL · 24–31 OCTOBER</small><h3>Kyoto family half-term</h3><p>Three considered options are ready for your review.</p></div><Link href="/approvals">Review options <ArrowRight size={16}/></Link></div>
    </section>
  </div>;
}
