"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { transcriptAsText } from "@/lib/transcript";
import type { IntakeCall } from "@/lib/types";

export function DeskNotepad({ call }: { call: IntakeCall | null }) {
  const [copied, setCopied] = useState(false);

  async function copyTranscript() {
    if (!call) return;
    await navigator.clipboard.writeText(transcriptAsText(call));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadTranscript() {
    if (!call) return;
    const blob = new Blob([JSON.stringify(call, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `acme-intake-${call.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="notepad">
      <div className="notepad-binding" aria-hidden="true" />
      <div className="notepad-header">
        <div>
          <p className="notepad-kicker">Handoff notes</p>
          <h2>Live transcript</h2>
        </div>
        <div className="notepad-actions">
          <Button asChild variant="outline" size="sm" className="notepad-chip">
            <Link href="/settings">
              <Settings />
              Settings
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="notepad-chip"
            onClick={copyTranscript}
            disabled={!call?.turns.length}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="notepad-chip"
            onClick={downloadTranscript}
            disabled={!call}
          >
            <Download />
            JSON
          </Button>
        </div>
      </div>
      <p className="notepad-help">
        Turns stay on this phone after hangup, in local storage, and at{" "}
        <code>POST /api/transcripts</code> for later processing.
      </p>
      <Separator className="bg-stone-300/80" />
      <ScrollArea className="notepad-body">
        {call?.turns.length ? (
          <ol className="notepad-turns">
            {call.turns.map((turn) => (
              <li key={turn.id}>
                <strong>{turn.speaker === "agent" ? "Eve" : "Caller"}</strong>
                <p>{turn.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="notepad-empty">
            No lines yet. Place the call from the phone — Eve greets first, then
            the conversation writes itself here.
          </p>
        )}
      </ScrollArea>
    </aside>
  );
}
