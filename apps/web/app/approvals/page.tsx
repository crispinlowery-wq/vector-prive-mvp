"use client";

import { apiFetch, getSession } from "@/lib/authClient";
import { Check, Clock3, ShieldCheck, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type RequestItem = { id: string; reference: string; title: string; status: string };
type Approval = { id: string; request_id: string; action_type: string; summary: string; amount: number | null; decision: "pending" | "approved" | "rejected"; decided_at: string | null };
type DecisionCapsule = { id: string; request_id: string | null; title: string; status: string; payload: { approval_id?: string; provider?: string; summary?: string; price?: string; terms?: string; liveStatus?: string; reasons?: string[]; authority?: string; expiresAt?: string; checkedAt?: string } };

export default function ApprovalsPage() {
  const [items, setItems] = useState<Array<{ request: RequestItem; approval: Approval }>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [capsules, setCapsules] = useState<DecisionCapsule[]>([]);

  async function load() {
    try {
      const requests = await apiFetch<RequestItem[]>("/requests");
      const [approvals, storedCapsules] = await Promise.all([Promise.all(requests.map(async (request) => ({ request, approvals: await apiFetch<Approval[]>(`/requests/${request.id}/approvals`) }))), apiFetch<DecisionCapsule[]>("/operations/decision_capsule")]);
      setItems(approvals.flatMap((entry) => entry.approvals.map((approval) => ({ request: entry.request, approval }))));
      setCapsules(storedCapsules);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load approvals"); }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id); setMessage("");
    try {
      await apiFetch(`/approvals/${id}`, { method: "PATCH", body: JSON.stringify({ decision, note: decision === "approved" ? "Approved in secure member portal" : "Declined in secure member portal" }) });
      setMessage(decision === "approved" ? "Approved. The concierge may now execute this exact quote." : "Declined. No booking will be made.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Decision failed"); }
    finally { setBusy(""); }
  }

  const role = getSession()?.user.role;
  return <main className="approval-page"><header><Link href="/" className="wordmark">VECTOR PRIVÉ</Link><span><ShieldCheck size={16}/> Secure approvals</span></header><section><p className="eyebrow">MEMBER AUTHORITY</p><h1>Review before anything is committed.</h1><p>Each decision is tied to the exact action, price and terms shown below.</p>{message && <div className="partner-message">{message}</div>}{role === "operator" && <div className="partner-message error">Operators cannot approve on a client’s behalf. Sign in as the member or an authorised PA.</div>}
    {!!capsules.length && <div className="member-decision-list"><div className="member-decision-title"><Sparkles/><div><small>DECISION CAPSULES</small><h2>Everything needed to decide in 60 seconds.</h2></div></div>{capsules.map((capsule) => { const approval = items.find((item) => item.approval.id === capsule.payload.approval_id)?.approval; return <article key={capsule.id} className={approval?.decision || capsule.status}><header><div><small>{capsule.payload.checkedAt || "Recently checked"}</small><h2>{capsule.title}</h2></div><span>{approval?.decision || capsule.status}</span></header><div className="member-decision-recommendation"><small>{capsule.payload.provider || "Vector research"}</small><h3>{capsule.payload.summary || "Recommendation prepared for review."}</h3>{capsule.payload.price && <strong>{capsule.payload.price}</strong>}<p>{capsule.payload.terms}</p><em><Check/>{capsule.payload.liveStatus || "Checked by Vector"}</em></div><div className="member-decision-reasons">{(capsule.payload.reasons || []).map((reason) => <span key={reason}><Check/>{reason}</span>)}</div><footer><div><ShieldCheck/><span><b>{capsule.payload.authority || "Secure approval required"}</b><small>{capsule.payload.expiresAt ? `Expires ${capsule.payload.expiresAt}` : "Exact terms shown above"}</small></span></div>{approval?.decision === "pending" && <aside><button onClick={() => decide(approval.id, "rejected")} disabled={!!busy}>Decline</button><button className="approve" onClick={() => decide(approval.id, "approved")} disabled={!!busy}>Approve exact decision</button></aside>}{approval?.decision === "approved" && <b className="capsule-approved"><Check/> Approved</b>}</footer></article>; })}</div>}
    <div className="approval-list">{items.length ? items.map(({ request, approval }) => <article key={approval.id}><div className={`approval-icon ${approval.decision}`}>{approval.decision === "approved" ? <Check/> : approval.decision === "rejected" ? <X/> : <Clock3/>}</div><div><small>{request.reference} · {approval.action_type.replaceAll("_", " ")}</small><h2>{request.title}</h2><p>{approval.summary}</p>{approval.amount != null && <strong>£{Number(approval.amount).toLocaleString()}</strong>}</div><aside>{approval.decision === "pending" ? <><button onClick={() => decide(approval.id, "rejected")} disabled={!!busy}>Decline</button><button className="approve" onClick={() => decide(approval.id, "approved")} disabled={!!busy}>Approve exact quote</button></> : <b>{approval.decision}</b>}</aside></article>) : !capsules.length && <div className="approval-empty">No approvals are waiting.</div>}</div></section></main>;
}
