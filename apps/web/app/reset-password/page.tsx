"use client";

import { resetPassword } from "@/lib/authClient";
import { Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function ResetPasswordView() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await resetPassword(token, password);
    setMessage(result.message);
    setBusy(false);
  }

  return <main className="login-page reset-page">
    <section className="login-cinema" aria-hidden="true">
      <div className="travel-film"><span className="sun"/><span className="mountain mountain-one"/><span className="mountain mountain-two"/><span className="shoreline"/></div>
      <div className="film-grain"/>
    </section>
    <section className="login-card-wrap">
      <Link href="/" className="login-logo"><span className="wordmark">VECTOR PRIVÉ</span></Link>
      <div className="login-card">
        <div className="login-kicker"><LockKeyhole size={14}/> Secure reset</div>
        <h1>Create a new password.</h1>
        <p>Choose a strong password for your Vector Privé account.</p>
        <form className="login-form" onSubmit={submit}>
          <label><span>New password</span><div><LockKeyhole size={17}/><input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required/></div></label>
          <button className="login-submit" disabled={busy || !token}>{busy ? "Updating…" : "Reset password"}</button>
        </form>
        {!token && <div className="login-message">This reset link is missing a token. Request a new link from the login page.</div>}
        {message && <div className="login-message"><Check size={15}/>{message}</div>}
      </div>
    </section>
  </main>;
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordView/></Suspense>;
}
