"use client";

import { useCallback, useEffect, useState } from "react";
import { applyDemoProfile } from "@/lib/agent-settings";
import type { DemoProfile } from "@/lib/seeds/types";

export function useDemoProfile() {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const reload = useCallback(async () => {
    const response = await fetch("/api/demo/profile", { cache: "no-store" });
    if (!response.ok) return null;
    const next = (await response.json()) as DemoProfile;
    applyDemoProfile(next);
    setProfile(next);
    return next;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { profile, reload };
}
