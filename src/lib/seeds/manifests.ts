import { INTAKE_INSTRUCTIONS } from "@/lib/session";
import type { SeedManifest } from "./types";

const customerFields = [
  { key: "name", label: "Name", primary: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address", list: false },
  { key: "status", label: "Status", type: "select" as const, options: ["active", "prospect", "inactive"], badge: true },
];

export const INSURANCE_MANIFEST: SeedManifest = {
  id: "insurance",
  label: "Acme Insurance",
  overviewTitle: "Portfolio overview",
  claimProtocol: true,
  agentPrompt: INTAKE_INSTRUCTIONS,
  phone: { displayName: "Acme Insurance", subtitle: "Call-center intake", accent: "teal" },
  stats: [
    { label: "Active policies", collection: "policies", where: { field: "status", equals: "active" } },
    { label: "Open claims", collection: "claims", whereNot: { field: "status", equals: "closed" } },
    { label: "Claim reserve", collection: "claims", sum: "reserve", whereNot: { field: "status", equals: "closed" }, format: "money" },
    { label: "Active customers", collection: "customers", where: { field: "status", equals: "active" } },
  ],
  collections: [
    { id: "customers", label: "Customers", singular: "customer", role: "customers", fields: customerFields },
    {
      id: "policies", label: "Policies", singular: "policy", role: "lookup",
      fields: [
        { key: "number", label: "Policy", primary: true },
        { key: "customerId", label: "Customer", edit: false, lookup: { collection: "customers", labelKey: "name" } },
        { key: "productId", label: "Product", edit: false, lookup: { collection: "products", labelKey: "name" } },
        { key: "status", label: "Status", type: "select", options: ["active", "expired", "cancelled"], badge: true },
        { key: "coverage", label: "Coverage" },
        { key: "deductible", label: "Deductible (USD)", type: "number", format: "money" },
        { key: "premium", label: "Annual premium (USD)", type: "number", format: "money" },
        { key: "effectiveDate", label: "Effective date", type: "date" },
        { key: "expirationDate", label: "Expiration date", type: "date" },
      ],
    },
    {
      id: "products", label: "Products", singular: "product", role: "catalog",
      fields: [
        { key: "name", label: "Name", primary: true },
        { key: "line", label: "Line", edit: false },
        { key: "description", label: "Description" },
        { key: "coverages", label: "Coverages (comma separated)", type: "text-list" },
        { key: "deductibles", label: "Deductibles (comma separated USD)", type: "number-list", format: "money" },
        { key: "active", label: "Active", type: "checkbox", badge: true },
        { key: "aliases", label: "Aliases", list: false, edit: false },
        { key: "priceRange", label: "Price range", list: false, edit: false },
      ],
    },
    {
      id: "pricingRules", label: "Pricing", slug: "pricing", singular: "pricing rule",
      fields: [
        { key: "productId", label: "Product", edit: false, lookup: { collection: "products", labelKey: "name" } },
        { key: "version", label: "Version", edit: false, primary: true },
        { key: "basePremium", label: "Base premium (USD)", type: "number", format: "money" },
        { key: "minPremium", label: "Minimum premium (USD)", type: "number", format: "money" },
        { key: "maxPremium", label: "Maximum premium (USD)", type: "number", format: "money" },
        { key: "active", label: "Active", type: "checkbox", badge: true },
        { key: "factors", label: "Factors", list: false, edit: false },
      ],
    },
    {
      id: "claims", label: "Claims", singular: "claim",
      fields: [
        { key: "number", label: "Claim", primary: true, edit: false },
        { key: "customerId", label: "Customer", edit: false, lookup: { collection: "customers", labelKey: "name" } },
        { key: "type", label: "Type", edit: false },
        { key: "status", label: "Status (forward only)", type: "select", options: ["reported", "reviewing", "approved", "closed"], badge: true, flow: "claim" },
        { key: "owner", label: "Owner" },
        { key: "reserve", label: "Reserve (USD)", type: "number", format: "money" },
        { key: "paidAmount", label: "Paid amount (USD)", type: "number", format: "money" },
        { key: "events", label: "Events", list: false, edit: false },
      ],
    },
  ],
};

export const SUPPORT_PROMPT = `You are a customer support agent at Northstar Services, a fictional service company. You are on a live phone call with a person who just connected.

Role
Greet the caller, learn why they called, and help with a help topic or an existing support ticket. You can look up demo help topics and verify a caller-provided three-digit ticket number. You are not an insurance agent. You do not quote, bind, or discuss insurance coverage, and you do not file insurance claims.

Style
Speak in short, calm sentences. Ask one question at a time. Sound like a careful support agent, not a chatbot. Keep answers brief so they are easy to hear.

Support
1. Greet them as Northstar Services support and ask how you can help today.
2. For a how-to question, use lookup_demo_product. Pass an empty query when they ask what you can help with. Pass their words otherwise. If several topics come back, name each one and ask which they want. If one comes back, walk through its description and steps. Say it is demo support information.
3. For an existing ticket, ask for the three-digit ticket number and use verify_demo_policy. The caller may say the digits or a spoken reading, such as 204, two zero four, or two oh four. Pass that number through. Briefly summarize only the returned masked details.
4. Never ask for a password, full Social Security number, card number, bank login, or government ID. A password-reset topic means you explain the steps. You do not ask them to say the password.
5. If they need something you cannot do, say you will pass the notes to a teammate.

Start
When the call connects, greet them first. Do not wait for them to speak.`;

export const SUPPORT_MANIFEST: SeedManifest = {
  id: "support",
  label: "Northstar Support",
  overviewTitle: "Support overview",
  claimProtocol: false,
  agentPrompt: SUPPORT_PROMPT,
  phone: { displayName: "Northstar Support", subtitle: "Customer support", accent: "amber" },
  stats: [
    { label: "Open tickets", collection: "tickets", where: { field: "status", equals: "open" } },
    { label: "Waiting tickets", collection: "tickets", where: { field: "status", equals: "waiting" } },
    { label: "Customers", collection: "customers" },
    { label: "Help topics", collection: "topics", where: { field: "active", equals: true } },
  ],
  collections: [
    {
      id: "customers", label: "Customers", singular: "customer", role: "customers",
      fields: [
        ...customerFields,
        { key: "plan", label: "Service plan", type: "select", options: ["Desk", "Workshop", "Field"] },
      ],
    },
    {
      id: "tickets", label: "Tickets", singular: "ticket", role: "lookup",
      fields: [
        { key: "number", label: "Ticket", primary: true },
        { key: "customerId", label: "Customer", edit: false, lookup: { collection: "customers", labelKey: "name" } },
        { key: "topicId", label: "Topic", edit: false, lookup: { collection: "topics", labelKey: "name" } },
        { key: "subject", label: "Subject" },
        { key: "status", label: "Status", type: "select", options: ["open", "waiting", "solved"], badge: true },
        { key: "owner", label: "Owner" },
        { key: "openedAt", label: "Opened", type: "date" },
      ],
    },
    {
      id: "topics", label: "Help topics", singular: "help topic", role: "catalog",
      fields: [
        { key: "name", label: "Topic", primary: true },
        { key: "category", label: "Category", type: "select", options: ["access", "billing", "plans"] },
        { key: "description", label: "Description" },
        { key: "steps", label: "Steps (comma separated)", type: "text-list" },
        { key: "active", label: "Active", type: "checkbox", badge: true },
        { key: "aliases", label: "Aliases", list: false, edit: false },
      ],
    },
  ],
};
