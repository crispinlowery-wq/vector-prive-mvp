"use client";

import { apiFetch, ensureSession, getSession } from "@/lib/authClient";
import { ArrowLeft, Check, Eye, FileKey2, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const commitments = [
  { icon: Eye, title: "Never sold. Never advertised.", detail: "Your information is not sold, rented or used to advertise to you. We share only the minimum information required to fulfil a service you have asked us to arrange." },
  { icon: UserRoundCheck, title: "A human firewall for sensitive actions.", detail: "AI can prepare options, but it cannot independently access full passport information, use a payment method, change authority or make a booking." },
  { icon: LockKeyhole, title: "Payment details stay with the payment provider.", detail: "Vector stores payment references, not raw card numbers. Any charge or consequential commitment follows the authority and approval rules on your account." },
  { icon: FileKey2, title: "Sensitive documents are purpose-limited.", detail: "When travel documents are needed, access is limited to the authorised people and the stated purpose. We do not use them for general research or personalisation." },
];

export default function TrustCentre() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestType, setRequestType] = useState("review");
  const [history, setHistory] = useState<Array<{ id: string; request_type: string; status: string }>>([]);

  async function loadRequests() {
    try { setHistory(await apiFetch("/privacy/requests")); } catch { /* A private history requires an authenticated member session. */ }
  }
  useEffect(() => { void loadRequests(); }, []);

  async function requestPrivacyReview() {
    if (!getSession() && !await ensureSession()) { router.push("/login"); return; }
    setBusy(true); setStatus("");
    try {
      await apiFetch("/privacy/requests", { method: "POST", body: JSON.stringify({ request_type: requestType }) });
      setStatus("Your private request has been sent to the Vector team.");
      await loadRequests();
    } catch (error) { setStatus(error instanceof Error ? error.message : "We could not send your request."); }
    finally { setBusy(false); }
  }

  return <main className="trust-centre">
    <header><Link href="/" aria-label="Back to Vector Privé"><ArrowLeft size={16}/> Member home</Link><span className="wordmark">VECTOR PRIVÉ</span></header>
    <section className="trust-intro"><span><ShieldCheck size={20}/> THE VECTOR TRUST CENTRE</span><h1>Your life is private.<br/><em>It stays that way.</em></h1><p>Vector is designed to earn trust through restraint. We use your information only to provide the service you have asked for, and keep humans accountable for every sensitive decision.</p></section>
    <section className="trust-promise"><div><small>OUR PROMISE</small><h2>Confidential by design, not by slogan.</h2></div><p>Technology helps Vector prepare, remember and coordinate. It never replaces your authority, and it never gives an individual or an AI unrestricted access to the most sensitive parts of your life.</p></section>
    <section className="trust-grid">{commitments.map(({ icon: Icon, title, detail }) => <article key={title}><span><Icon size={20}/></span><h2>{title}</h2><p>{detail}</p></article>)}</section>
    <section className="trust-controls"><div><small>YOUR CONTROL</small><h2>Questions, corrections or a private review.</h2><p>Ask us to review what Vector holds, correct information, receive a copy of your data or discuss deletion and retention. A named team member will handle the request.</p></div><div className="trust-action"><select value={requestType} onChange={(event) => setRequestType(event.target.value)}><option value="review">Review my data and access</option><option value="correction">Correct my information</option><option value="export">Request a copy of my data</option><option value="deletion">Discuss deletion and retention</option></select><button onClick={() => void requestPrivacyReview()} disabled={busy}>{busy ? "Sending…" : <>Send private request <Check size={16}/></>}</button></div>{status && <p className="trust-status">{status}</p>}{history.length > 0 && <div className="trust-history"><small>YOUR RECENT REQUESTS</small>{history.map((item) => <p key={item.id}>{item.request_type} <span>{item.status}</span></p>)}</div>}</section>
    <footer><ShieldCheck size={15}/> Vector does not promise that risk does not exist. We promise clear limits, careful controls and accountable human judgement when your information matters most.</footer>
  </main>;
}
