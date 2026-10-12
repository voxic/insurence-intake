"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditForm, type EditField, type EditTarget } from "@/components/backoffice-edit-form";
import { nextClaimStatuses } from "@/lib/backoffice/view-model";
import type { ClaimStatus } from "@/lib/backoffice/types";
import type { DemoRow, FieldDef } from "@/lib/seeds/types";

type CollectionView = {
  id: string;
  label: string;
  slug?: string;
  singular: string;
  href: string;
  role?: string;
  fields: FieldDef[];
  rows: DemoRow[];
};

function isClaimStatus(value: string): value is ClaimStatus {
  return value === "reported" || value === "reviewing" || value === "approved" || value === "closed";
}
type Workspace = {
  seedId: string;
  label: string;
  overviewTitle: string;
  stats: { label: string; value: string; href: string }[];
  collections: CollectionView[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function listFields(collection: CollectionView) {
  return collection.fields.filter((field) => field.list !== false && field.key !== "id");
}

function cellText(row: DemoRow, field: FieldDef, collections: CollectionView[]) {
  const value = row[field.key];
  if (field.lookup) {
    const related = collections.find((collection) => collection.id === field.lookup?.collection);
    const match = related?.rows.find((item) => item.id === value);
    const label = match?.[field.lookup.labelKey];
    return typeof label === "string" ? label : String(value ?? "");
  }
  if (field.type === "checkbox") return value ? "Active" : "Inactive";
  if (Array.isArray(value)) {
    return field.format === "money" ? value.map((item) => money.format(Number(item))).join(", ") : value.join(", ");
  }
  if (field.format === "money" && typeof value === "number") return money.format(value);
  if (value === undefined || value === null || typeof value === "object") return "";
  return String(value);
}

function badgeVariant(value: string) {
  if (["active", "approved", "open", "true", "Active", "booked", "scheduled"].includes(value)) return "default" as const;
  if (["inactive", "closed", "expired", "cancelled", "solved", "Inactive"].includes(value)) return "secondary" as const;
  if (["reported"].includes(value)) return "destructive" as const;
  return "outline" as const;
}

function editTarget(collection: CollectionView, row: DemoRow): EditTarget {
  const primary = collection.fields.find((field) => field.primary) ?? collection.fields[0];
  const titleValue = primary ? cellText(row, primary, [collection]) : row.id;
  const fields: EditField[] = collection.fields.filter((field) => field.edit !== false).map((field) => {
    if (field.flow === "claim" && field.options) {
      const current = String(row[field.key] ?? "");
      const allowed = isClaimStatus(current) ? [current, ...nextClaimStatuses(current as ClaimStatus)] : field.options;
      return { key: field.key, label: field.label, type: "select", options: field.options.filter((option) => allowed.includes(option)) };
    }
    return { key: field.key, label: field.label, type: field.type, options: field.options };
  });
  return {
    title: `Edit ${collection.singular} · ${titleValue}`,
    url: `/api/backoffice/workspace/${collection.id}/${row.id}`,
    record: row,
    fields,
  };
}

export function BackofficeApp({ collection: collectionKey }: { collection?: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const load = async () => {
    const response = await fetch("/api/backoffice/workspace", { cache: "no-store" });
    setWorkspace((await response.json()) as Workspace);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const reset = async () => {
    if (!window.confirm("Reset this seed? In-memory edits will be discarded.")) return;
    await fetch("/api/backoffice/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "RESET_DEMO_DATA" }) });
    setEditing(null);
    await load();
  };
  const current = collectionKey
    ? workspace?.collections.find((collection) => collection.id === collectionKey || collection.slug === collectionKey || collection.href.endsWith(`/${collectionKey}`))
    : undefined;
  const rows = useMemo(() => {
    if (!current || !workspace) return [];
    const fields = listFields(current);
    const needle = query.trim().toLowerCase();
    if (!needle) return current.rows;
    return current.rows.filter((row) => fields.some((field) => cellText(row, field, workspace.collections).toLowerCase().includes(needle)));
  }, [current, query, workspace]);

  if (!workspace) return <main className="backoffice-loading">Loading demo workspace…</main>;
  return (
    <main className="backoffice-shell">
      <aside className="backoffice-nav">
        <div>
          <p className="backoffice-eyebrow">{workspace.label}</p>
          <h1>Operations</h1>
          <p className="backoffice-demo">Local demo. Synthetic data only — no real customers, PII, or payment data.</p>
          <p className="backoffice-demo">Edits live in memory and reset when you switch seeds, restart, or redeploy.</p>
        </div>
        <nav aria-label="Backoffice">
          <div>
            <Link aria-current={collectionKey ? undefined : "page"} className={collectionKey ? "" : "active"} href="/backoffice">Overview</Link>
            {workspace.collections.map((collection) => (
              <Link key={collection.id} aria-current={current?.id === collection.id ? "page" : undefined} className={current?.id === collection.id ? "active" : ""} href={collection.href}>{collection.label}</Link>
            ))}
          </div>
        </nav>
        <div className="backoffice-nav-actions">
          <Button asChild variant="outline"><Link href="/">Desk phone</Link></Button>
          <Button variant="outline" onClick={reset}>Reset demo data</Button>
        </div>
      </aside>
      <section className="backoffice-content">
        <header className="backoffice-header">
          <div>
            <p className="backoffice-eyebrow">Backoffice</p>
            <h2>{current ? current.label : workspace.overviewTitle}</h2>
          </div>
          <Badge variant="outline">Synthetic demo data only — no real PII</Badge>
        </header>
        {collectionKey && !current ? <p>This seed has no collection by that name.</p> : null}
        {!current ? <Overview workspace={workspace} /> : (
          <>
            <label className="backoffice-search">Search {current.label}
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, number, or status" />
            </label>
            {editing ? <EditForm key={editing.url} target={editing} onCancel={() => setEditing(null)} onSaved={async () => { await load(); setEditing(null); }} /> : null}
            <CollectionTable collection={current} rows={rows} collections={workspace.collections} onEdit={(row) => setEditing(editTarget(current, row))} />
          </>
        )}
      </section>
    </main>
  );
}

function Overview({ workspace }: { workspace: Workspace }) {
  const lookup = workspace.collections.find((collection) => collection.role === "lookup") ?? workspace.collections[0];
  return (
    <div className="backoffice-grid">
      {workspace.stats.map((stat) => (
        <Link key={stat.label} className="backoffice-metric backoffice-metric-link" href={stat.href}>
          <p>{stat.label}</p>
          <strong>{stat.value}</strong>
          <small>View all →</small>
        </Link>
      ))}
      {lookup ? (
        <CollectionTable className="span-2" title={lookup.label} collection={lookup} rows={lookup.rows.slice(0, 5)} collections={workspace.collections} />
      ) : null}
    </div>
  );
}

function CollectionTable({ collection, rows, collections, onEdit, title, className }: { collection: CollectionView; rows: DemoRow[]; collections: CollectionView[]; onEdit?: (row: DemoRow) => void; title?: string; className?: string }) {
  const fields = listFields(collection);
  return (
    <section className={className ? `backoffice-panel ${className}` : "backoffice-panel"}>
      {title ? <h3>{title}</h3> : null}
      <table>
        <thead>
          <tr>
            {fields.map((field) => <th key={field.key}>{field.label}</th>)}
            {onEdit ? <th><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {fields.map((field) => {
                const text = cellText(row, field, collections);
                return (
                  <td key={field.key}>
                    {field.primary ? <strong>{text}</strong> : field.badge ? <Badge variant={badgeVariant(text)}>{text}</Badge> : text}
                  </td>
                );
              })}
              {onEdit ? <td className="row-actions"><Button type="button" size="sm" variant="outline" onClick={() => onEdit(row)}>Edit</Button></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
