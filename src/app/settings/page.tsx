import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings-panel";

export const metadata: Metadata = {
  title: "Agent settings · Acme Insurance intake",
  description: "Edit the Eve intake instructions used on the next voice call.",
};

export default function SettingsPage() {
  return (
    <div className="desk">
      <div className="desk-glow" aria-hidden="true" />
      <div className="desk-stage settings-stage">
        <SettingsPanel />
      </div>
      <p className="desk-caption">
        Settings live on this desk, not in the live call. Hang up first if a
        session is open — the next Call picks up the saved prompt.
      </p>
    </div>
  );
}
