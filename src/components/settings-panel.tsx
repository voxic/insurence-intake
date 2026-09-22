"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  loadInstructions,
  loadPushToTalk,
  resetInstructions,
  saveInstructions,
  savePushToTalk,
  subscribeInstructions,
  subscribePushToTalk,
} from "@/lib/agent-settings";
import { INTAKE_INSTRUCTIONS } from "@/lib/session";

export function SettingsPanel() {
  const saved = useSyncExternalStore(
    subscribeInstructions,
    loadInstructions,
    () => INTAKE_INSTRUCTIONS,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const pushToTalk = useSyncExternalStore(
    subscribePushToTalk,
    loadPushToTalk,
    () => false,
  );
  const [status, setStatus] = useState<"idle" | "saved" | "reset" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const value = draft ?? saved;
  const dirty = value !== saved;
  const isDefault = value === INTAKE_INSTRUCTIONS;

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

  return (
    <section className="settings-folder">
      <div className="settings-tab" aria-hidden="true">
        Settings
      </div>
      <div className="settings-body">
        <header className="settings-header">
          <div>
            <p className="notepad-kicker">Eve · session.update</p>
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
          This prompt is sent on the next Call in <code>session.update</code>.
          Edits stay in this browser under <code>acme-intake-instructions</code>.
          The API key never appears here.
        </p>
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
              : status === "reset"
                ? "Restored the Acme intake default."
                : status === "error"
                  ? error
                  : dirty
                    ? "Unsaved changes"
                    : isDefault
                      ? "Using the default intake persona"
                      : "Custom instructions are active"}
          </p>
        </div>
      </div>
    </section>
  );
}
