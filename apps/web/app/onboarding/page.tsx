"use client";

import { apiFetch, ensureSession } from "@/lib/authClient";
import { ArrowLeft, ArrowRight, Check, ImagePlus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type FormState = {
  full_name: string;
  phone: string;
  timezone: string;
  preferred_contact: string;
  household: string;
  assistant_name: string;
  assistant_email: string;
  travel_style: string[];
  hotel_style: string[];
  flight_preferences: string;
  dietary_requirements: string;
  accessibility_requirements: string;
  interests: string[];
  service_style: string;
  important_dates: string;
  anything_else: string;
  confirmed_accurate: boolean;
};

const initial: FormState = {
  full_name: "", phone: "", timezone: "Europe/London", preferred_contact: "whatsapp",
  household: "", assistant_name: "", assistant_email: "", travel_style: [], hotel_style: [],
  flight_preferences: "", dietary_requirements: "", accessibility_requirements: "", interests: [],
  service_style: "", important_dates: "", anything_else: "", confirmed_accurate: false,
};

const travelOptions = ["Culture & discovery", "Rest & privacy", "Family time", "Adventure", "Business travel", "Celebrations"];
const hotelOptions = ["Intimate boutique", "Grand hotel", "Private villa", "Contemporary design", "Wellness retreat", "Exceptional location"];
const interestOptions = ["Dining", "Art & culture", "Sport", "Wellness", "Fashion", "Wine", "Music", "Automotive", "Yachting", "Family experiences"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [canEditPhoto, setCanEditPhoto] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const user = await ensureSession();
      if (!user) return;
      setCanEditPhoto(user.role === "client" || user.role === "pa");
      try {
        const data = await apiFetch<{ completed: boolean; full_name: string; email: string; phone?: string; timezone: string; profile: Partial<FormState>; profile_photo_data_url?: string | null }>("/onboarding");
        setEmail(data.email);
        setPhoto(data.profile_photo_data_url || null);
        setForm((current) => ({ ...current, ...data.profile, full_name: data.full_name || user.full_name, phone: data.phone || "", timezone: data.timezone || "Europe/London", confirmed_accurate: false }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "We could not load your private profile.");
      } finally { setLoading(false); }
    })();
  }, [router]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: "travel_style" | "hotel_style" | "interests", value: string) {
    const current = form[key];
    update(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function next() {
    setError("");
    if (step === 0 && form.full_name.trim().length < 2) { setError("Please tell us your name."); return; }
    setStep((value) => Math.min(value + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function choosePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 32_000_000) {
      setError("Please choose a JPEG, PNG or WebP photo smaller than 32 MB.");
      return;
    }
    setPhotoSaving(true); setError("");
    try {
      const dataUrl = await resizeProfilePhoto(file);
      const result = await apiFetch<{ profile_photo_data_url: string }>("/profile-photo", { method: "PUT", body: JSON.stringify({ data_url: dataUrl }) });
      setPhoto(result.profile_photo_data_url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save that photo.");
    } finally { setPhotoSaving(false); }
  }

  async function removePhoto() {
    setPhotoSaving(true); setError("");
    try {
      await apiFetch<void>("/profile-photo", { method: "DELETE" });
      setPhoto(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not remove that photo.");
    } finally { setPhotoSaving(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.confirmed_accurate) { setError("Please confirm that these details are accurate."); return; }
    setSaving(true); setError("");
    try {
      await apiFetch("/onboarding", { method: "PUT", body: JSON.stringify(form) });
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save your profile.");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="onboarding-page"><div className="onboarding-loading"><Sparkles/>Preparing your private profile…</div></main>;

  return <main className="onboarding-page">
    <div className="onboarding-shade"/>
    <section className="onboarding-shell">
      <header className="onboarding-brand"><span>VP</span><div><strong>VECTOR PRIVÉ</strong><small>PRIVATE MEMBER INTRODUCTION</small></div></header>
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of 4`}>
        {[0, 1, 2, 3].map((item) => <i key={item} className={item <= step ? "active" : ""}/>)}
      </div>
      <form onSubmit={submit} className="onboarding-card">
        <div className="onboarding-step"><span>0{step + 1} / 04</span><small>Your answers stay within your private client profile.</small></div>

        {step === 0 && <>
          <p className="onboarding-eyebrow">THE ESSENTIALS</p>
          <h1>How should Vector know you?</h1>
          <p className="onboarding-intro">A few details help your concierge respond naturally from the first request.</p>
          {canEditPhoto ? <div className="profile-photo-picker">
            <div className="profile-photo-preview">{photo ? <img src={photo} alt="Your profile"/> : <span>{form.full_name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "VP"}</span>}</div>
            <div><strong>Your profile photo</strong><p>Choose from Apple Photos, Google Photos or your device. Vector crops and securely stores a private copy.</p><div className="profile-photo-actions"><label className="photo-button"><ImagePlus/> {photoSaving ? "Saving…" : photo ? "Choose another" : "Choose a photo"}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={photoSaving} onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ""; }}/></label>{photo && <button type="button" className="photo-remove" disabled={photoSaving} onClick={() => void removePhoto()}><Trash2/>Remove</button>}</div></div>
          </div> : <div className="profile-photo-note">Profile photos are stored against private member profiles. Sign in as the member to add or change one.</div>}
          <div className="onboarding-grid two">
            <label>Full name<input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} autoComplete="name" required/></label>
            <label>Email<input value={email} disabled/></label>
            <label>Mobile or WhatsApp<input value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" placeholder="+44…"/></label>
            <label>Time zone<select value={form.timezone} onChange={(e) => update("timezone", e.target.value)}><option>Europe/London</option><option>Europe/Paris</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Asia/Dubai</option><option>Asia/Singapore</option><option>Asia/Hong_Kong</option></select></label>
            <label>Preferred contact<select value={form.preferred_contact} onChange={(e) => update("preferred_contact", e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Phone</option><option value="app">Vector app</option></select></label>
          </div>
          <label>Who should we normally consider part of your household or travelling party?<textarea value={form.household} onChange={(e) => update("household", e.target.value)} placeholder="Partner, children, family members, ages where useful…"/></label>
        </>}

        {step === 1 && <>
          <p className="onboarding-eyebrow">TRAVEL & STAYS</p>
          <h1>What makes travel feel right?</h1>
          <p className="onboarding-intro">Choose any that resonate. These guide research; they never authorise a booking.</p>
          <fieldset><legend>Your usual travel rhythm</legend><div className="choice-grid">{travelOptions.map((item) => <button type="button" key={item} className={form.travel_style.includes(item) ? "selected" : ""} onClick={() => toggle("travel_style", item)}>{form.travel_style.includes(item) && <Check/>}{item}</button>)}</div></fieldset>
          <fieldset><legend>Places you enjoy staying</legend><div className="choice-grid">{hotelOptions.map((item) => <button type="button" key={item} className={form.hotel_style.includes(item) ? "selected" : ""} onClick={() => toggle("hotel_style", item)}>{form.hotel_style.includes(item) && <Check/>}{item}</button>)}</div></fieldset>
          <label>Flight preferences<textarea value={form.flight_preferences} onChange={(e) => update("flight_preferences", e.target.value)} placeholder="Airlines, cabin, seats, airports, luggage or routines worth remembering…"/></label>
        </>}

        {step === 2 && <>
          <p className="onboarding-eyebrow">TASTE & WELLBEING</p>
          <h1>The details that change the answer.</h1>
          <p className="onboarding-intro">Tell us what suppliers must get right and what makes an experience feel distinctly yours.</p>
          <label>Dietary requirements or allergies<textarea value={form.dietary_requirements} onChange={(e) => update("dietary_requirements", e.target.value)} placeholder="Include severity or cross-contamination considerations where relevant…"/></label>
          <label>Accessibility or wellbeing requirements<textarea value={form.accessibility_requirements} onChange={(e) => update("accessibility_requirements", e.target.value)} placeholder="Mobility, sensory, medical-device or other practical considerations…"/></label>
          <fieldset><legend>Interests and passions</legend><div className="choice-grid compact">{interestOptions.map((item) => <button type="button" key={item} className={form.interests.includes(item) ? "selected" : ""} onClick={() => toggle("interests", item)}>{form.interests.includes(item) && <Check/>}{item}</button>)}</div></fieldset>
        </>}

        {step === 3 && <>
          <p className="onboarding-eyebrow">HOW WE WORK TOGETHER</p>
          <h1>Your preferred service style.</h1>
          <p className="onboarding-intro">Vector will remain human-supervised. These details shape communication, not authority.</p>
          <div className="onboarding-grid two"><label>PA or assistant name<input value={form.assistant_name} onChange={(e) => update("assistant_name", e.target.value)}/></label><label>PA or assistant email<input type="email" value={form.assistant_email} onChange={(e) => update("assistant_email", e.target.value)}/></label></div>
          <label>How would you like recommendations presented?<textarea value={form.service_style} onChange={(e) => update("service_style", e.target.value)} placeholder="One clear recommendation, a concise shortlist, level of detail, how often to update you…"/></label>
          <label>Important dates or recurring occasions<textarea value={form.important_dates} onChange={(e) => update("important_dates", e.target.value)} placeholder="Birthdays, anniversaries, school holidays or annual events…"/></label>
          <label>Anything else we should understand?<textarea value={form.anything_else} onChange={(e) => update("anything_else", e.target.value)} placeholder="Preferences, dislikes, routines or boundaries…"/></label>
          <label className="onboarding-confirm"><input type="checkbox" checked={form.confirmed_accurate} onChange={(e) => update("confirmed_accurate", e.target.checked)}/><span><strong>I confirm these details are accurate.</strong><small>I can ask Vector to change or delete them at any time.</small></span></label>
        </>}

        {error && <div className="onboarding-error">{error}</div>}
        <footer>
          {step > 0 ? <button type="button" className="back" onClick={() => setStep(step - 1)}><ArrowLeft/>Back</button> : <span/>}
          {step < 3 ? <button type="button" className="continue" onClick={next}>Continue<ArrowRight/></button> : <button className="continue" disabled={saving}>{saving ? "Saving securely…" : <>Complete profile<ShieldCheck/></>}</button>}
        </footer>
      </form>
      <p className="onboarding-privacy"><ShieldCheck/>Encrypted in transit. Passport and payment details should never be entered here.</p>
    </section>
  </main>;
}

function resizeProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      // A small, square JPEG keeps uploads fast and remains comfortably under the API limit.
      canvas.width = 384; canvas.height = 384;
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(source); reject(new Error("This browser could not prepare the photo.")); return; }
      context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 384, 384);
      URL.revokeObjectURL(source);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("This device could not prepare that photo. Please export it from Photos as a JPEG, PNG or WebP and try again.")); };
    image.src = source;
  });
}
