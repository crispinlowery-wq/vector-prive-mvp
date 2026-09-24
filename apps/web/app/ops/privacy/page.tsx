"use client";

import { apiFetch, ensureSession, getSession } from "@/lib/authClient";
import { Check, FileKey2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type PrivacyRequest = { id: string; request_type: string; status: "received" | "in_progress" | "resolved"; note: string | null; created_at: string; client_name: string | null; client_email: string | null };

export default function PrivacyDesk() {
  const [items, setItems] = useState<PrivacyRequest[]>([]); const [message, setMessage] = useState(""); const [busy, setBusy] = useState("");
  async function load() { try { setItems(await apiFetch<PrivacyRequest[]>("/privacy/requests")); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load the privacy queue."); } }
  useEffect(() => { void ensureSession().then(() => { const role = getSession()?.user.role; if (["operator", "admin"].includes(role || "")) void load(); else setMessage("Operator access is required."); }); }, []);
  async function update(item: PrivacyRequest, status: PrivacyRequest["status"]) { setBusy(item.id); try { await apiFetch(`/privacy/requests/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update this request."); } finally { setBusy(""); } }
  return <div className="content membership-desk privacy-desk"><div className="page-heading"><div><p className="eyebrow">TRUST & CONFIDENTIALITY</p><h1>Privacy desk</h1><p>Named human handling for client data, access and retention requests.</p></div><span className="partner-mode"><ShieldCheck size={15}/>{items.filter((item) => item.status !== "resolved").length} open</span></div>{message && <div className="partner-message error">{message}</div>}<section className="panel membership-list">{items.length === 0 ? <div className="approval-empty"><FileKey2 size={22}/><p>No privacy requests are waiting.</p></div> : items.map((item) => <article key={item.id}><div className="membership-avatar"><ShieldCheck size={18}/></div><div><small>{item.request_type.replaceAll("_", " ")} · {new Date(item.created_at).toLocaleDateString()}</small><h2>{item.client_name || "Private member"}</h2><p>{item.client_email || "Member identity protected"}</p>{item.note && <blockquote>{item.note}</blockquote>}</div><aside><span className={`membership-status ${item.status}`}>{item.status === "resolved" && <Check size={13}/>}{item.status.replaceAll("_", " ")}</span>{item.status === "received" && <button disabled={busy === item.id} onClick={() => void update(item, "in_progress")}>Take ownership</button>}{item.status === "in_progress" && <button disabled={busy === item.id} onClick={() => void update(item, "resolved")}>Mark resolved</button>}</aside></article>)}</section></div>;
}
