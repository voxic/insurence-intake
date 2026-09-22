"use client";

import { FormEvent, useState } from "react";

export function DemoLoginGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not unlock the demo.");
      }
      setPassword("");
      onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not unlock the demo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="demo-login-backdrop" role="dialog" aria-modal="true" aria-labelledby="demo-login-title">
      <form className="demo-login-card" onSubmit={submit}>
        <p className="demo-login-eyebrow">Acme Insurance</p>
        <h1 id="demo-login-title">Demo access</h1>
        <p>Enter the shared demo password to use the desk phone.</p>
        <label htmlFor="demo-password">Password</label>
        <input
          id="demo-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
        {error ? <p className="demo-login-error" role="alert">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Unlocking…" : "Enter demo"}
        </button>
      </form>
    </div>
  );
}
