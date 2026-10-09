"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export type EditField = {
  key: string; label: string;
  type?: "text" | "number" | "date" | "select" | "checkbox" | "text-list" | "number-list";
  options?: readonly string[];
};
export type EditTarget = { title: string; url: string; fields: EditField[]; record: Record<string, unknown> };
type Values = Record<string, string | boolean>;

function initialValues(target: EditTarget): Values {
  return Object.fromEntries(target.fields.map((field) => {
    const value = target.record[field.key];
    if (field.type === "checkbox") return [field.key, Boolean(value)];
    if (field.type === "text-list" || field.type === "number-list") return [field.key, Array.isArray(value) ? value.join(", ") : ""];
    return [field.key, value === undefined || value === null ? "" : String(value)];
  }));
}
export function toPatch(fields: EditField[], values: Values): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => {
    const value = values[field.key];
    if (field.type === "checkbox") return [field.key, Boolean(value)];
    const text = String(value ?? "").trim();
    if (field.type === "number") return [field.key, Number(text)];
    const list = text.split(",").map((x) => x.trim()).filter(Boolean);
    if (field.type === "number-list") return [field.key, list.map(Number)];
    if (field.type === "text-list") return [field.key, list];
    return [field.key, text];
  }));
}
export function describeError(body: unknown, status: number) {
  const parsed = body as { error?: string; details?: { properties?: Record<string, { errors?: string[] }> } } | null;
  const fields = Object.entries(parsed?.details?.properties ?? {}).map(([key, issue]) => `${key}: ${issue.errors?.join(" ") ?? "invalid"}`);
  return [parsed?.error ?? `Save failed (${status}).`, ...fields].join(" ");
}

export function EditForm({ target, onSaved, onCancel }: { target: EditTarget; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [values, setValues] = useState<Values>(() => initialValues(target));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: string, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    const response = await fetch(target.url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPatch(target.fields, values)) });
    if (response.ok) await onSaved(); else setError(describeError(await response.json().catch(() => null), response.status));
    setSaving(false);
  };
  return <form className="backoffice-panel edit-panel" onSubmit={submit} aria-label={target.title}>
    <div className="panel-title"><h3>{target.title}</h3><small>Saved in memory only — resets on the next deploy or restart.</small></div>
    <div className="form-grid edit-grid">{target.fields.map((field) => <label key={field.key}>{field.label}
      {field.type === "select"
        ? <select value={String(values[field.key])} onChange={(e) => set(field.key, e.target.value)}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        : field.type === "checkbox"
          ? <input type="checkbox" checked={Boolean(values[field.key])} onChange={(e) => set(field.key, e.target.checked)} />
          : <input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} step={field.type === "number" ? "any" : undefined} value={String(values[field.key])} onChange={(e) => set(field.key, e.target.value)} />}
    </label>)}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="form-actions"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
  </form>;
}
