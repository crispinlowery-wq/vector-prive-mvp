"use client";

import { apiFetch, getSession } from "@/lib/authClient";
import { CheckCircle2, Hotel, Loader2, Search, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Client = { id: string; full_name: string; email: string | null; tier: string };
type RequestItem = { id: string; reference: string; client_id: string; title: string; status: string };
type Offer = { provider: string; offer_id: string; hotel_name: string; room_name: string; amount: number; currency: string; refundable: boolean; cancellation: Record<string, unknown> };
type Quote = { id: string; request_id: string; approval_id: string; provider: string; hotel_name: string; room_name: string; amount: number; currency: string; status: string; cancellation: Record<string, unknown> };

export default function PartnerHotelsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [requestId, setRequestId] = useState("");
  const [clientId, setClientId] = useState("");
  const [city, setCity] = useState("Paris");
  const [country, setCountry] = useState("FR");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const start = new Date(); start.setDate(start.getDate() + 30);
    const end = new Date(start); end.setDate(end.getDate() + 3);
    setCheckin(start.toISOString().slice(0, 10)); setCheckout(end.toISOString().slice(0, 10));
    Promise.all([apiFetch<Client[]>("/clients"), apiFetch<RequestItem[]>("/requests")])
      .then(([nextClients, nextRequests]) => {
        setClients(nextClients); setRequests(nextRequests); setClientId(nextClients[0]?.id || "");
        setRequestId(nextRequests[0]?.id || "");
      }).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!requestId) { setQuotes([]); return; }
    apiFetch<Quote[]>(`/requests/${requestId}/hotel-quotes`).then(setQuotes).catch(() => setQuotes([]));
  }, [requestId]);

  async function createHotelRequest() {
    if (!clientId) return;
    setBusy(true); setMessage("");
    try {
      const created = await apiFetch<RequestItem>("/requests", { method: "POST", body: JSON.stringify({ client_id: clientId, title: `Hotel in ${city}`, message: `Find an approved hotel in ${city} for ${checkin} to ${checkout}.`, category: "travel", channel: "operator" }) });
      setRequests((current) => [created, ...current]); setRequestId(created.id); setMessage(`${created.reference} created. Search can now be attached to this client request.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create request"); }
    finally { setBusy(false); }
  }

  async function searchHotels(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setOffers([]);
    try {
      const results = await apiFetch<Offer[]>("/partners/hotels/search", { method: "POST", body: JSON.stringify({ city_name: city, country_code: country, checkin, checkout, currency: "GBP", guest_nationality: "GB", occupancies: [{ adults: 2, children: [] }], refundable_only: true, max_rates_per_hotel: 2 }) });
      setOffers(results); setMessage(`${results.length} live or sandbox rates returned. No booking has been made.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Search failed"); }
    finally { setBusy(false); }
  }

  async function stageQuote(offer: Offer) {
    if (!requestId) { setMessage("Create or select a client request first."); return; }
    setBusy(true); setMessage("");
    try {
      const quote = await apiFetch<Quote>(`/requests/${requestId}/hotel-quotes`, { method: "POST", body: JSON.stringify({ offer_id: offer.offer_id, hotel_name: offer.hotel_name, room_name: offer.room_name }) });
      setQuotes((current) => [quote, ...current]); setMessage("Price and terms reconfirmed. The exact quote now awaits client or PA approval.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not prebook quote"); }
    finally { setBusy(false); }
  }

  async function book(quote: Quote) {
    const session = getSession();
    if (!session) return;
    setBusy(true); setMessage("");
    const key = `vp_${requestId.replaceAll("-", "")}_${quote.id.replaceAll("-", "")}`.slice(0, 150);
    try {
      const result = await apiFetch<{ confirmation_code: string; status: string }>(`/hotel-quotes/${quote.id}/book`, { method: "POST", body: JSON.stringify({ idempotency_key: key, holder: { first_name: "Amelia", last_name: "Hart", email: "amelia@vectorprive.test" }, guests: [{ occupancy_number: 1, first_name: "Amelia", last_name: "Hart", email: "amelia@vectorprive.test", remarks: "Quiet room requested" }] }) });
      setMessage(`Booking ${result.status}. Confirmation ${result.confirmation_code || "pending"}.`);
      setQuotes((current) => current.map((item) => item.id === quote.id ? { ...item, status: "booked" } : item));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Booking failed"); }
    finally { setBusy(false); }
  }

  return <div className="content partner-page">
    <div className="page-heading"><div><p className="eyebrow">CONTROLLED CONNECTIVITY</p><h1>Hotel partner desk</h1><p>Search, reconfirm, approve, then book—with every consequential step recorded.</p></div><span className="partner-mode"><ShieldCheck size={16}/> {offers[0]?.provider || "Configured provider"}</span></div>
    {getSession()?.user.role === "client" && <div className="partner-message error">Sign in with an operator account to use the partner desk.</div>}
    {message && <div className="partner-message">{message}</div>}
    <div className="partner-grid">
      <section className="panel partner-panel"><h2>1. Client request</h2><label>Client<select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name} · {client.tier}</option>)}</select></label><button className="primary" onClick={createHotelRequest} disabled={busy || !clientId}>Create hotel request</button><label>Active request<select value={requestId} onChange={(e) => setRequestId(e.target.value)}><option value="">Select a request</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.reference} · {request.title} · {request.status}</option>)}</select></label></section>
      <form className="panel partner-panel" onSubmit={searchHotels}><h2>2. Search rates</h2><div className="partner-fields"><label>City<input value={city} onChange={(e) => setCity(e.target.value)} required/></label><label>Country<input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} required/></label><label>Check in<input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} required/></label><label>Check out<input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} required/></label></div><button className="primary" disabled={busy || !requestId}>{busy ? <Loader2 className="spin" size={16}/> : <Search size={16}/>} Search partner</button></form>
    </div>
    {offers.length > 0 && <section className="panel partner-results"><h2>Available rates</h2>{offers.map((offer) => <article key={offer.offer_id}><Hotel/><div><strong>{offer.hotel_name}</strong><span>{offer.room_name} · {offer.refundable ? "Refundable" : "Non-refundable"}</span></div><b>{offer.currency} {Number(offer.amount).toLocaleString()}</b><button onClick={() => stageQuote(offer)} disabled={busy}>Reconfirm & request approval</button></article>)}</section>}
    {quotes.length > 0 && <section className="panel partner-results"><h2>Stored quotes</h2>{quotes.map((quote) => <article key={quote.id}><CheckCircle2/><div><strong>{quote.hotel_name}</strong><span>{quote.room_name} · Status: {quote.status.replaceAll("_", " ")}</span></div><b>{quote.currency} {Number(quote.amount).toLocaleString()}</b><button onClick={() => book(quote)} disabled={busy || quote.status !== "approved"}>{quote.status === "approved" ? "Book approved quote" : quote.status === "booked" ? "Booked" : "Awaiting approval"}</button></article>)}</section>}
  </div>;
}
