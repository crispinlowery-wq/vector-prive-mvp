"use client";

import { addClientSignal, bootstrapLearningFromSeed, loadClientProfiles, removeClientSignal, resetClientProfiles, updateClientSignal, type ClientProfile, type SignalCollection } from "@/lib/clientIntelligence";
import { apiFetch } from "@/lib/authClient";
import { passionProfiles } from "@/lib/accessOS";
import { CheckCircle2, Crown, Database, EyeOff, HeartHandshake, Plus, RefreshCcw, Search, Sparkles, Trash2, Users } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

export default function Clients() {
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [newCollection, setNewCollection] = useState<SignalCollection>("preferences");
  const [noteStatus, setNoteStatus] = useState("");

  useEffect(() => {
    bootstrapLearningFromSeed();
    const loaded = loadClientProfiles();
    setProfiles(loaded);
    setSelectedName(loaded[0]?.name || "");

    void apiFetch<ServerClient[]>("/clients").then((records) => {
      const live = records.filter((record) => record.onboarding_completed_at).map(serverClientProfile);
      const names = new Set(live.map((profile) => profile.name));
      const merged = [...live, ...loaded.filter((profile) => !names.has(profile.name))];
      setProfiles(merged);
      if (live[0]) setSelectedName(live[0].name);
    }).catch(() => undefined);

    const sync = () => setProfiles(loadClientProfiles());
    window.addEventListener("vector-prive-client-memory-updated", sync);
    return () => window.removeEventListener("vector-prive-client-memory-updated", sync);
  }, []);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return profiles.filter((profile) => `${profile.name} ${profile.tier} ${profile.location} ${profile.summary}`.toLowerCase().includes(term));
  }, [profiles, query]);

  const selected = profiles.find((profile) => profile.name === selectedName) || filtered[0] || profiles[0];
  const selectedPassions = passionProfiles.find((profile) => profile.client === selected?.name);

  function resetMemory() {
    resetClientProfiles();
    bootstrapLearningFromSeed();
    const loaded = loadClientProfiles();
    setProfiles(loaded);
    setSelectedName(loaded[0]?.name || "");
  }

  function refreshProfiles() { setProfiles(loadClientProfiles()); }

  async function addVerifiedFact() {
    if (!selected || !newLabel.trim() || !newDetail.trim()) return;
    if (selected.serverId) {
      setNoteStatus("Saving…");
      try {
        const item = await apiFetch<ServerPreference>(`/clients/${selected.serverId}/preferences`, { method: "POST", body: JSON.stringify({ category: newCollection, label: newLabel.trim(), note: newDetail.trim(), confirmed_by_client: false }) });
        const signal = serverSignal(item, selected.serverId, selected.preferences.length + selected.life.length + selected.dietary.length + selected.serviceStyle.length);
        setProfiles((current) => current.map((profile) => profile.name === selected.name ? { ...profile, [newCollection]: [...profile[newCollection], signal], recentSignals: [signal, ...profile.recentSignals].slice(0, 8) } : profile));
        setNewLabel(""); setNewDetail(""); setNoteStatus("Saved with Vector employee provenance");
      } catch (caught) { setNoteStatus(caught instanceof Error ? caught.message : "Could not save this note"); }
      return;
    }
    addClientSignal(selected.name, newCollection, newLabel.trim(), newDetail.trim());
    setNewLabel(""); setNewDetail(""); setNoteStatus("Saved in the demonstration profile"); refreshProfiles();
  }

  return <div className="content client-repository">
    <div className="page-heading">
      <div><p className="eyebrow">RELATIONSHIPS</p><h1>Client intelligence repository</h1><p>Automatically learned household, lifestyle, companion and preference memory.</p></div>
      <button className="primary" onClick={resetMemory}><RefreshCcw size={17}/>Rebuild memory</button>
    </div>

    <div className="memory-console">
      <section className="memory-sidebar">
        <div className="filterbar"><div className="search wide"><Search size={17}/><input placeholder="Find client, preference, city…" value={query} onChange={(event) => setQuery(event.target.value)}/></div></div>
        <div className="memory-client-list">
          {filtered.map((profile) => <button key={profile.name} className={selected?.name === profile.name ? "selected" : ""} onClick={() => setSelectedName(profile.name)}>
            <div className="avatar lg">{profile.photo ? <img src={profile.photo} alt=""/> : profile.initials}</div>
            <div><strong>{profile.name}</strong><span>{profile.tier}</span><p>{profile.location}</p></div>
          </button>)}
        </div>
      </section>

      {selected && <section className="memory-detail">
        <div className="memory-hero-card">
          <div><div className="avatar lg">{selected.photo ? <img src={selected.photo} alt=""/> : selected.initials}</div><span>{selected.tier}</span></div>
          <div><p className="eyebrow">LIVING PROFILE</p><h2>{selected.name}</h2><p>{selected.summary}</p></div>
          <aside><small>12M VALUE</small><b>{selected.spend}</b><small>MEMORY SIGNALS</small><b>{countSignals(selected)}</b></aside>
        </div>

        <div className="memory-grid">
          <section className="memory-panel life-graph-control">
            <div className="memory-panel-head"><Sparkles/><h3>Add a Vector note</h3></div>
            <p>Employee notes are saved with their author and kept distinct from client-confirmed questionnaire answers.</p>
            <div><select value={newCollection} onChange={(event) => setNewCollection(event.target.value as SignalCollection)}><option value="preferences">Preference</option><option value="life">Life context</option><option value="dietary">Dietary & wellbeing</option><option value="serviceStyle">Service style</option></select><input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Short label"/><textarea value={newDetail} onChange={(event) => setNewDetail(event.target.value)} placeholder="What Vector should remember and why…"/><button onClick={() => void addVerifiedFact()}><Plus/>Save to profile</button>{noteStatus && <small>{noteStatus}</small>}</div>
          </section>
          {selectedPassions && <section className="memory-panel passion-panel">
            <div className="memory-panel-head"><Crown/><h3>Passion graph</h3></div>
            <div className="memory-tags">{selectedPassions.passions.map((item) => <span key={item}>{item}</span>)}</div>
            <p>{selectedPassions.dailyHook}</p>
            <em>{selectedPassions.nextGesture}</em>
          </section>}
          <MemoryPanel title="Family & household" icon={<Users/>} items={selected.household}/>
          <MemoryPanel title="Travels with" icon={<HeartHandshake/>} items={selected.travelWith}/>
          <SignalPanel title="Preferences" signals={selected.preferences} profileName={selected.name} collection="preferences" onChange={refreshProfiles}/>
          <SignalPanel title="Dietary & wellbeing" signals={selected.dietary} profileName={selected.name} collection="dietary" onChange={refreshProfiles}/>
          <SignalPanel title="Life context" signals={selected.life} profileName={selected.name} collection="life" onChange={refreshProfiles}/>
          <SignalPanel title="Service style" signals={selected.serviceStyle} profileName={selected.name} collection="serviceStyle" onChange={refreshProfiles}/>
        </div>

        <section className="learned-feed">
          <div><Sparkles/><h3>Recently learned</h3></div>
          {selected.recentSignals.length ? selected.recentSignals.map((signal) => <article key={signal.id}>
            <span>{signal.confidence}%</span>
            <div><b>{signal.label}</b><p>{signal.detail}</p><small>Source: {signal.source}</small></div>
          </article>) : <p>No new learned signals yet. New requests will populate this automatically.</p>}
        </section>
      </section>}
    </div>
  </div>;
}

type ServerClient = {
  id: string;
  full_name: string;
  email: string | null;
  tier: string;
  phone: string | null;
  timezone: string;
  onboarding_completed_at: string | null;
  household_notes: string | null;
  profile_data: Record<string, unknown>;
  profile_photo_data_url: string | null;
  preferences: ServerPreference[];
};

type ServerPreference = { id?: string; category: string; statement: string; confidence: number; source_type?: string; source_reference?: string | null; status?: string; observation_count?: number };

function serverSignal(item: ServerPreference, clientId: string, index: number) {
  const sourceNames: Record<string, string> = { questionnaire: "Client questionnaire", client_feedback: "Client feedback", employee_note: `Vector note${item.source_reference ? ` · ${item.source_reference}` : ""}`, service_request: `Service usage${item.source_reference ? ` · ${item.source_reference}` : ""}` };
  return {
    id: item.id || `${clientId}-${index}`,
    label: item.category.replace("onboarding:", "").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
    detail: item.statement,
    confidence: Math.round(item.confidence * 100),
    source: sourceNames[item.source_type || ""] || "Client memory",
    status: item.status === "confirmed" ? "confirmed" as const : "inferred" as const,
  };
}

function serverClientProfile(client: ServerClient): ClientProfile {
  const all = client.preferences.map((item, index) => serverSignal(item, client.id, index));
  const by = (...categories: string[]) => all.filter((_, index) => categories.includes(client.preferences[index].category));
  const interests = Array.isArray(client.profile_data.interests)
    ? client.profile_data.interests.filter((item): item is string => typeof item === "string")
    : [];
  return {
    serverId: client.id,
    name: client.full_name,
    initials: client.full_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    photo: client.profile_photo_data_url || undefined,
    tier: client.tier,
    location: client.timezone.replace("_", " "),
    spend: "New member",
    summary: `Onboarded client${client.email ? ` · ${client.email}` : ""}${client.phone ? ` · ${client.phone}` : ""}`,
    household: client.household_notes ? [client.household_notes] : [],
    travelWith: client.household_notes ? [client.household_notes] : [],
    preferences: by("onboarding:travel_style", "onboarding:hotel_style", "onboarding:flight_preferences", "general", "travel_atmosphere", "hotel_style", "hotel_room", "flight_seat", "transport"),
    dietary: by("onboarding:dietary_requirements", "onboarding:accessibility_requirements", "dietary", "accessibility"),
    serviceStyle: by("onboarding:service_style", "service_style"),
    life: [
      ...by("onboarding:important_dates", "onboarding:anything_else", "onboarding:interests", "interest", "feedback_note"),
      ...interests.map((item, index) => ({ id: `${client.id}-interest-${index}`, label: item, detail: "Confirmed interest from client questionnaire.", confidence: 100, source: "Client questionnaire", status: "confirmed" as const })),
    ],
    recentSignals: all.slice(0, 8),
  };
}

function MemoryPanel({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return <section className="memory-panel">
    <div className="memory-panel-head">{icon}<h3>{title}</h3></div>
    <div className="memory-tags">{items.length ? items.map((item) => <span key={item}>{item}</span>) : <em>Not learned yet</em>}</div>
  </section>;
}

function SignalPanel({ title, signals, profileName, collection, onChange }: { title: string; signals: ClientProfile["preferences"]; profileName: string; collection: SignalCollection; onChange: () => void }) {
  return <section className="memory-panel signal-panel">
    <div className="memory-panel-head"><Database/><h3>{title}</h3></div>
    {signals.length ? signals.map((signal) => <article key={signal.id} className={signal.status || "inferred"}>
      <div><b>{signal.label}</b><span>{signal.status === "confirmed" ? "Confirmed" : signal.status === "hidden" ? "Hidden" : `${signal.confidence}% inferred`}</span></div>
      <p>{signal.detail}</p>
      <small>Why Vector knows this: {signal.source} · {signal.expiresAt ? `Expires ${signal.expiresAt}` : "No expiry"}</small>
      <footer><button onClick={() => { updateClientSignal(profileName, collection, signal.id, { status: "confirmed", confidence: 100, source: "Confirmed by client" }); onChange(); }}><CheckCircle2/>Confirm</button><button onClick={() => { updateClientSignal(profileName, collection, signal.id, { status: "hidden" }); onChange(); }}><EyeOff/>Hide</button><button className="delete" onClick={() => { removeClientSignal(profileName, collection, signal.id); onChange(); }}><Trash2/>Delete</button></footer>
    </article>) : <em>Not learned yet</em>}
  </section>;
}

function countSignals(profile: ClientProfile) {
  return profile.preferences.length + profile.life.length + profile.dietary.length + profile.serviceStyle.length + profile.recentSignals.length;
}
