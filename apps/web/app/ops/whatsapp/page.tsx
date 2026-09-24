"use client";

import { API_BASE, apiFetch, getSession } from "@/lib/authClient";
import { AlertTriangle, Check, Clock3, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WhatsAppMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  delivery_status: string | null;
  received_at: string;
};

type WhatsAppThread = {
  request_id: string;
  reference: string;
  client_name: string;
  client_phone: string | null;
  title: string;
  category: string;
  urgency: string;
  status: string;
  requires_approval: boolean;
  ai_draft: string | null;
  updated_at: string;
  messages: WhatsAppMessage[];
};

type UnmatchedMessage = { id: string; sender: string | null; body: string | null; message_type: string; received_at: string };
type InboxData = { threads: WhatsAppThread[]; unmatched: UnmatchedMessage[] };

export default function WhatsAppOperationsPage() {
  const [data, setData] = useState<InboxData>({ threads: [], unmatched: [] });
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Checking WhatsApp connection…");
  const [enabled, setEnabled] = useState(false);
  const [authorised, setAuthorised] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => data.threads.find((thread) => thread.request_id === selectedId) || data.threads[0], [data.threads, selectedId]);

  async function loadInbox() {
    setBusy(true);
    try {
      const [inbox, health] = await Promise.all([
        apiFetch<InboxData>("/integrations/whatsapp/inbox"),
        fetch(`${API_BASE}/health`).then((response) => response.json()),
      ]);
      setData(inbox);
      if (!selectedId && inbox.threads[0]) setSelectedId(inbox.threads[0].request_id);
      const isEnabled = health.whatsapp === "enabled";
      setEnabled(isEnabled);
      setStatus(isEnabled ? "WhatsApp Cloud API enabled" : "Safe mode — awaiting Meta credentials");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load WhatsApp inbox");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const session = getSession();
    if (!session || !["operator", "admin"].includes(session.user.role)) {
      setStatus("Operator account required");
      return;
    }
    setAuthorised(true);
    loadInbox();
  }, []);
  useEffect(() => { setDraft(selected?.ai_draft || ""); }, [selected?.request_id, selected?.ai_draft]);

  async function sendReply() {
    if (!selected || !draft.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/requests/${selected.request_id}/messages/whatsapp`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      setStatus("Reply sent and audit record created");
      await loadInbox();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reply could not be sent");
    } finally {
      setBusy(false);
    }
  }

  return <div className="wa-page">
    <header className="wa-title">
      <div><p className="eyebrow">CLIENT CHANNELS</p><h1>WhatsApp operations</h1><p>Live client requests, human-reviewed replies and unknown-number controls.</p></div>
      <button onClick={loadInbox} disabled={busy}><RefreshCw/> Refresh</button>
    </header>

    <div className={`wa-connection ${enabled ? "enabled" : "disabled"}`}>
      {enabled ? <Check/> : <ShieldCheck/>}<div><strong>{status}</strong><p>{enabled ? "Signed webhooks and operator replies are active." : authorised ? "No messages can be sent or accepted until the Meta test credentials are configured." : "Your current session cannot access client channel data."}</p></div>
    </div>

    {!authorised && <div className="wa-access-warning"><AlertTriangle/><div><strong>This channel is restricted to Vector operators.</strong><p>Sign out and use the operator account to review client conversations or send replies.</p></div></div>}

    <section className="wa-grid">
      <aside className="wa-threads">
        <div className="wa-section-head"><div><small>RECOGNISED CLIENTS</small><h2>Conversations</h2></div><b>{data.threads.length}</b></div>
        {data.threads.length ? data.threads.map((thread) => <button key={thread.request_id} className={selected?.request_id === thread.request_id ? "active" : ""} onClick={() => setSelectedId(thread.request_id)}>
          <div><span className="wa-avatar"><UserRound/></span><div><strong>{thread.client_name}</strong><small>{thread.reference} · {thread.category}</small></div><time>{new Date(thread.updated_at).toLocaleDateString()}</time></div>
          <p>{thread.messages.at(-1)?.body || thread.title}</p>
          <footer><span>{thread.status.replaceAll("_", " ")}</span>{thread.requires_approval && <b>Approval required</b>}</footer>
        </button>) : <div className="wa-empty"><MessageCircle/><p>No recognised WhatsApp conversations yet.</p></div>}
      </aside>

      <main className="wa-conversation">
        {selected ? <>
          <header><div><h2>{selected.client_name}</h2><p>{selected.client_phone} · {selected.reference}</p></div><span>{selected.status.replaceAll("_", " ")}</span></header>
          <div className="wa-messages">
            {selected.messages.map((message) => <article key={message.id} className={message.direction}>
              <p>{message.body}</p><footer><time>{new Date(message.received_at).toLocaleString()}</time>{message.direction === "outbound" && <span>{message.delivery_status || "pending"}</span>}</footer>
            </article>)}
          </div>
          <div className="wa-composer">
            {selected.requires_approval && <div className="wa-approval-warning"><AlertTriangle/><span>This request contains a consequential action. WhatsApp may explain the proposal, but approval must remain in the secure Vector Privé flow.</span><Link href="/approvals">Open secure approval</Link></div>}
            <label>Operator-reviewed reply<textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write or review the proposed reply…"/></label>
            <div><span><Clock3/> Free-form replies require an open 24-hour service window.</span><button onClick={sendReply} disabled={busy || !enabled || !draft.trim()}><Send/> Send reply</button></div>
          </div>
        </> : <div className="wa-empty conversation"><MessageCircle/><h2>Waiting for the first client message</h2><p>Once Meta is connected, recognised clients will appear here automatically.</p></div>}
      </main>

      <aside className="wa-unmatched">
        <div className="wa-section-head"><div><small>IDENTITY CONTROL</small><h2>Unknown numbers</h2></div><b>{data.unmatched.length}</b></div>
        <div className="wa-identity-note"><ShieldCheck/><p>These messages are never attached to a client automatically. Verify the sender outside WhatsApp before updating a client record.</p></div>
        {data.unmatched.map((message) => <article key={message.id}><strong>{message.sender || "Invalid number"}</strong><p>{message.body || `Unsupported ${message.message_type} message`}</p><time>{new Date(message.received_at).toLocaleString()}</time></article>)}
        {!data.unmatched.length && <div className="wa-empty"><Check/><p>No unknown senders awaiting review.</p></div>}
      </aside>
    </section>
  </div>;
}
