"use client";

import { loginWithPassword, requestPasswordReset } from "@/lib/authClient";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Plane, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("amelia@vectorprive.test");
  const [password, setPassword] = useState("VectorDemo!2026");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await loginWithPassword(email, password);
    setMessage(result.message);
    setBusy(false);
    if (result.ok) window.setTimeout(() => router.push("/"), 550);
  }

  async function forgotPassword() {
    setBusy(true);
    const result = await requestPasswordReset(email);
    setMessage(result);
    setBusy(false);
  }

  return <main className="login-page">
    <section className="login-cinema" aria-hidden="true">
      <div className="glamour-reel">
        <article className="reel-card st-tropez">
          <span className="reel-label">ST TROPEZ · GOLDEN HOUR</span>
          <span className="glamour-figure figure-one"/>
          <span className="glamour-figure figure-two"/>
          <span className="sunset-disc"/>
          <b>Riviera arrivals</b>
        </article>
        <article className="reel-card private-jet">
          <span className="reel-label">PRIVATE JET · LONDON TO NICE</span>
          <span className="jet-body"/>
          <span className="jet-window window-one"/>
          <span className="jet-window window-two"/>
          <span className="jet-window window-three"/>
          <b>Door-to-door calm</b>
        </article>
        <article className="reel-card yacht">
          <span className="reel-label">YACHT · CLUB 55</span>
          <span className="yacht-line"/>
          <span className="yacht-sail"/>
          <span className="champagne"/>
          <b>Sea-level privacy</b>
        </article>
        <article className="reel-card beach-club">
          <span className="reel-label">CAPRI · AMALFI · MYKONOS</span>
          <span className="pool-shimmer"/>
          <span className="glamour-figure figure-three"/>
          <b>Tables, tenders, terraces</b>
        </article>
        <div className="reel-status"><Plane size={16}/> Short-form travel reels curated for members</div>
      </div>
      <div className="film-grain"/>
      <div className="destination-strip">
        <span>ST TROPEZ</span><span>PRIVATE JETS</span><span>YACHTS</span><span>RIVIERA</span>
      </div>
    </section>

    <section className="login-card-wrap">
      <Link href="/" className="login-logo" aria-label="Vector Privé">
        <span className="wordmark">VECTOR PRIVÉ</span>
      </Link>

      <div className="login-card">
        <div className="login-kicker"><Sparkles size={14}/> Private member access</div>
        <h1>Your world, perfectly orchestrated.</h1>
        <p>Secure access for Vector Privé members and their private office team.</p>

        <form onSubmit={submit} className="login-form">
          <label>
            <span>Email address</span>
            <div><Mail size={17}/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email"/></div>
          </label>
          <label>
            <span>Password</span>
            <div><LockKeyhole size={17}/><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password"/><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
          </label>
          <button className="login-submit" disabled={busy}>{busy ? "Checking…" : <>Sign in <ArrowRight size={17}/></>}</button>
        </form>

        <button className="forgot-toggle" onClick={() => setForgotOpen((value) => !value)}>Forgot password?</button>
        {forgotOpen && <div className="forgot-panel">
          <p>Enter your email above and we’ll send a secure reset link.</p>
          <button onClick={forgotPassword} disabled={busy}>Send reset password link</button>
        </div>}

        {message && <div className="login-message"><Check size={15}/>{message}</div>}

        <div className="login-security"><ShieldCheck size={16}/> Passwords are hashed server-side. Reset links are tokenised and expire automatically.</div>
        <Link className="login-apply-link" href="/apply">Considering membership? Apply to Vector Privé</Link>
      </div>
    </section>
  </main>;
}
