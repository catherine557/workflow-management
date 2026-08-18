"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setMessage(error ? error.message : "Check your email for a secure sign-in link.");
    setPending(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="login-mark">WM</span>
        <p className="eyebrow">Shared operations workspace</p>
        <h1>Sign in to Workflow Management</h1>
        <p>Authorized team members see the same live task and evidence snapshot. Google source access remains connected once by an administrator.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">Work email</label>
          <div className="login-input"><Mail size={18} /><input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></div>
          <button className="primary-button" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}<ArrowRight size={17} /></button>
        </form>
        {message ? <p className="login-message" role="status">{message}</p> : null}
        <div className="login-security"><ShieldCheck size={17} /><span>Access is allowlisted and enforced on every server request.</span></div>
      </section>
    </main>
  );
}
