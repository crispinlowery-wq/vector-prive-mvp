"use client";

import { apiFetch } from "@/lib/authClient";
import { Building2, CalendarDays, ExternalLink, Linkedin, Search, ShieldCheck, UserRoundSearch } from "lucide-react";
import { useEffect, useState } from "react";

type Contact = {
  id: string;
  full_name: string;
  linkedin_url: string;
  company: string | null;
  position: string | null;
  connected_on: string | null;
  source: string;
  relationship_status: string;
};

type ContactPage = { items: Contact[]; total: number; offset: number; limit: number };

const PAGE_SIZE = 60;

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ q: query, company, offset: String(offset), limit: String(PAGE_SIZE) });
        const result = await apiFetch<ContactPage>(`/contacts?${params}`);
        setContacts(result.items);
        setTotal(result.total);
      } catch (error) {
        setContacts([]);
        setTotal(0);
        setMessage(error instanceof Error ? error.message : "Could not load the private network.");
      } finally {
        setLoading(false);
      }
    }, 240);
    return () => window.clearTimeout(timer);
  }, [query, company, offset]);

  function updateQuery(value: string) { setQuery(value); setOffset(0); }
  function updateCompany(value: string) { setCompany(value); setOffset(0); }

  return <div className="content contacts-page">
    <section className="contacts-hero">
      <div><p className="eyebrow">VECTOR RELATIONSHIP CAPITAL</p><h1>Private network</h1><p>Search Crispin’s LinkedIn relationships by person, organisation or role.</p></div>
      <aside><ShieldCheck/><span><b>Operator only</b><small>Profile links and professional context · no messages or exported email addresses</small></span></aside>
    </section>

    <section className="contacts-controls">
      <label><Search/><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Name, role or organisation…"/></label>
      <label><Building2/><input value={company} onChange={(event) => updateCompany(event.target.value)} placeholder="Filter organisation…"/></label>
      <div><strong>{total.toLocaleString()}</strong><span>matching relationships</span></div>
    </section>

    {message && <div className="partner-message error">{message}</div>}
    <section className="contact-directory" aria-busy={loading}>
      {loading ? <div className="contact-empty"><UserRoundSearch/><b>Searching the private network…</b></div> : contacts.length ? contacts.map((contact) => <article key={contact.id}>
        <div className="contact-avatar">{initials(contact.full_name)}</div>
        <div className="contact-identity"><small>{contact.relationship_status} · LinkedIn</small><h2>{contact.full_name}</h2><p>{contact.position || "Role not recorded"}</p><strong><Building2/>{contact.company || "Organisation not recorded"}</strong></div>
        <div className="contact-connected"><CalendarDays/><span><small>CONNECTED</small><b>{formatDate(contact.connected_on)}</b></span></div>
        <a href={contact.linkedin_url} target="_blank" rel="noreferrer"><Linkedin/>Open profile<ExternalLink/></a>
      </article>) : <div className="contact-empty"><UserRoundSearch/><b>No relationships match this search.</b><span>Try a name, organisation or broader role.</span></div>}
    </section>

    {!!contacts.length && <footer className="contact-pagination"><button disabled={!offset || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button><span>{(offset + 1).toLocaleString()}–{Math.min(offset + PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}</span><button disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button></footer>}
  </div>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Not recorded"; }
