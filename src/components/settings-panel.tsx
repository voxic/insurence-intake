"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoicePicker } from "@/components/voice-picker";
import {
  loadInstructions,
  loadPushToTalk,
  loadSeedPrompt,
  loadVoice,
  resetInstructions,
  saveInstructions,
  savePushToTalk,
  saveVoice,
  subscribeInstructions,
  subscribePushToTalk,
  subscribeVoice,
} from "@/lib/agent-settings";
import { useDemoProfile } from "@/hooks/use-demo-profile";
import { ACCENT_SWATCH } from "@/lib/seeds/phone";
import { ACCENTS, type AccentId } from "@/lib/seeds/types";
import { INTAKE_INSTRUCTIONS } from "@/lib/session";
import { DEFAULT_VOICE_ID, voiceName } from "@/lib/voices";

export function SettingsPanel() {
  const saved = useSyncExternalStore(
    subscribeInstructions,
    loadInstructions,
    () => INTAKE_INSTRUCTIONS,
  );
  const seedPrompt = useSyncExternalStore(
    subscribeInstructions,
    loadSeedPrompt,
    () => INTAKE_INSTRUCTIONS,
  );
  const { profile, reload } = useDemoProfile();
  const [draft, setDraft] = useState<string | null>(null);
  const [seedChoice, setSeedChoice] = useState<string | null>(null);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [phoneName, setPhoneName] = useState<string | null>(null);
  const [phoneAccent, setPhoneAccent] = useState<AccentId | null>(null);
  const pushToTalk = useSyncExternalStore(
    subscribePushToTalk,
    loadPushToTalk,
    () => false,
  );
  const voiceId = useSyncExternalStore(subscribeVoice, loadVoice, () => DEFAULT_VOICE_ID);
  const [status, setStatus] = useState<"idle" | "saved" | "phone" | "reset" | "switched" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const value = draft ?? saved;
  const dirty = value !== saved;
  const isDefault = value === seedPrompt;
  const activeSeed = seedChoice ?? profile?.seedId ?? "insurance";
  const displayName = phoneName ?? profile?.phone.displayName ?? "Acme Insurance";
  const accent = phoneAccent ?? profile?.phone.accent ?? "teal";

  function persist() {
    try {
      saveInstructions(value);
      setDraft(null);
      setError(null);
      setStatus("saved");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Could not save.");
    }
  }

  function restoreDefault() {
    const next = resetInstructions();
    setDraft(null);
    setError(null);
    setStatus("reset");
    return next;
  }

  async function switchSeed() {
    const next = profile?.seeds.find((seed) => seed.id === activeSeed);
    if (!next || next.id === profile?.seedId) return;
    setStatus("idle");
    const response = await fetch("/api/demo/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedId: next.id, confirmation: "SWITCH_DEMO_SEED" }),
    });
    if (!response.ok) {
      setStatus("error");
      setError("Could not switch the demo seed.");
      return;
    }
    setConfirmSeed(false);
    setDraft(null);
    setPhoneName(null);
    setPhoneAccent(null);
    await reload();
    setStatus("switched");
  }

  async function savePhone() {
    const response = await fetch("/api/demo/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, accent }),
    });
    if (!response.ok) {
      setStatus("error");
      setError("Could not save the phone name.");
      return;
    }
    setPhoneName(null);
    setPhoneAccent(null);
    await reload();
    setStatus("phone");
  }

  return (
    <section className="settings-folder">
      <div className="settings-tab" aria-hidden="true">
        Settings
      </div>
      <div className="settings-body">
        <header className="settings-header">
          <div>
            <p className="notepad-kicker">{voiceName(voiceId)} · session.update</p>
            <h1>Agent instructions</h1>
          </div>
          <Button asChild variant="outline" size="sm" className="notepad-chip">
            <Link href="/">
              <ArrowLeft />
              Desk phone
            </Link>
          </Button>
        </header>
        <p className="settings-help">
          The prompt and voice are sent on the next Call in <code>session.update</code>.
          Edits stay in this browser under <code>acme-intake-instructions</code> and{" "}
          <code>acme-intake-voice</code>. The API key never appears here.
        </p>
        <section className="settings-seed" aria-label="Demo seed">
          <p className="settings-label">Demo seed</p>
          <p className="settings-help">
            Switching reseeds the in-memory backoffice from that seed and discards runtime edits.
            A restart boots Acme Insurance again.
          </p>
          <div className="settings-seed-list" role="radiogroup" aria-label="Demo seed">
            {(profile?.seeds ?? [{ id: "insurance", label: "Acme Insurance" }, { id: "support", label: "Northstar Support" }]).map((seed) => (
              <button
                key={seed.id}
                type="button"
                role="radio"
                aria-checked={activeSeed === seed.id}
                className={activeSeed === seed.id ? "is-current" : ""}
                onClick={() => {
                  setSeedChoice(seed.id);
                  setConfirmSeed(false);
                }}
              >
                <span>{seed.label}</span>
                {profile?.seedId === seed.id ? <small>Active</small> : null}
              </button>
            ))}
          </div>
          {confirmSeed ? (
            <div className="settings-confirm">
              <p>Switch to {profile?.seeds.find((seed) => seed.id === activeSeed)?.label}? This wipes in-memory edits and the phone name.</p>
              <Button type="button" className="settings-save" onClick={() => void switchSeed()}>Confirm switch</Button>
              <Button type="button" variant="outline" className="notepad-chip" onClick={() => setConfirmSeed(false)}>Cancel</Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="notepad-chip"
              disabled={!profile || activeSeed === profile.seedId}
              onClick={() => setConfirmSeed(true)}
            >
              Switch seed
            </Button>
          )}
        </section>
        <section className="settings-seed" aria-label="Phone name and accent">
          <p className="settings-label">Phone on the desk</p>
          <p className="settings-help">
            The desk phone uses this name and accent. A manual change lasts until the next seed switch or restart.
          </p>
          <label className="settings-label" htmlFor="phone-display-name">Display name</label>
          <input
            id="phone-display-name"
            className="settings-phone-name"
            value={displayName}
            onChange={(event) => setPhoneName(event.target.value)}
          />
          <div className="settings-accents" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((id) => (
              <button
                key={id}
                type="button"
                className={accent === id ? "settings-accent is-current" : "settings-accent"}
                aria-pressed={accent === id}
                onClick={() => setPhoneAccent(id)}
              >
                <i style={{ background: ACCENT_SWATCH[id] }} />
                {id}
              </button>
            ))}
          </div>
          <Button type="button" className="settings-save" onClick={() => void savePhone()} disabled={displayName.trim().length < 2}>
            <Save />
            Save phone
          </Button>
        </section>
        <VoicePicker
          voiceId={voiceId}
          onSelect={(id) => {
            try {
              saveVoice(id);
            } catch (cause) {
              setStatus("error");
              setError(cause instanceof Error ? cause.message : "Could not save that voice.");
            }
          }}
        />
        <label className="settings-label" htmlFor="agent-instructions">
          System prompt
        </label>
        <Textarea
          id="agent-instructions"
          value={value}
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus("idle");
          }}
          spellCheck={false}
          className="settings-editor"
        />
        <div className="settings-ptt">
          <input
            id="push-to-talk"
            type="checkbox"
            checked={pushToTalk}
            onChange={(event) => savePushToTalk(event.target.checked)}
          />
          <label htmlFor="push-to-talk">
            <span>Push-to-talk</span>
            Hold Space (or the mic button) to speak. Use this in noisy rooms so
            Eve does not hear the crowd. This applies on the next Call.
          </label>
        </div>
        <div className="settings-toolbar">
          <Button
            type="button"
            className="settings-save"
            onClick={persist}
            disabled={!dirty || !value.trim()}
          >
            <Save />
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            className="notepad-chip"
            onClick={restoreDefault}
            disabled={isDefault && !dirty}
          >
            <RotateCcw />
            Reset to default
          </Button>
          <p className="settings-status" role="status">
            {status === "saved"
              ? "Saved. The next Call uses this prompt."
              : status === "phone"
                ? "Phone name and accent saved until the next seed switch or restart."
              : status === "reset"
                ? "Restored this seed's default prompt."
                : status === "switched"
                  ? "Switched seeds. In-memory edits were discarded."
                : status === "error"
                  ? error
                  : dirty
                    ? "Unsaved changes"
                    : isDefault
                      ? "Using this seed's default prompt"
                      : "Custom instructions are active"}
          </p>
        </div>
      </div>
    </section>
  );
}
