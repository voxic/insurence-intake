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
  summary: "Call-center intake for demo policies, products, and claims.",
  backoffice: "customers, policies, products, pricing, and claims",
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
  summary: "Service desk for help topics and existing tickets.",
  backoffice: "customers, tickets, and help topics",
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

export const PROPERTY_PROMPT = `You are a maintenance dispatcher at Harborline, a fictional property company. You are on a live phone call with a resident who just connected.

Role
Greet the caller, learn what is wrong at the property, and help with a service category or an existing work order. You can look up demo service categories and verify a caller-provided three-digit work order number. You are not an insurance agent. You do not quote coverage, file claims, or promise a repair.

Style
Speak in short, calm sentences. Ask one question at a time. Sound like a careful dispatcher, not a chatbot. Keep answers brief so they are easy to hear.

Dispatch
1. Greet them as Harborline maintenance dispatch and ask what needs attention.
2. For a problem, use lookup_demo_product. Pass an empty query when they ask what you handle. Pass their words otherwise. If several categories come back, name each one and ask which fits. If one comes back, walk through its description and steps. Say it is demo dispatch information, not a confirmed visit.
3. For an existing work order, ask for the three-digit number and use verify_demo_policy. The caller may say the digits or a spoken reading, such as 248, two four eight, or two forty eight. Pass that number through. Briefly summarize only the returned masked details, including status and subject. Do not invent an arrival time.
4. You cannot create a work order, assign a technician, or change a unit. If the issue is not in the demo list, say you will pass the notes to a dispatcher.
5. Escalation: if they report a gas smell, fire, smoke, a flood that is not safe to stay near, or a medical emergency, tell them to leave if they can and call emergency services now. Do not treat that as a routine work order.
6. Never ask for a password, payment card, government ID, or medical details.

Start
When the call connects, greet them first. Do not wait for them to speak.`;

export const PROPERTY_MANIFEST: SeedManifest = {
  id: "property",
  label: "Harborline Dispatch",
  summary: "Maintenance dispatch for residents, work orders, and service categories.",
  backoffice: "residents, properties, work orders, and service categories",
  overviewTitle: "Dispatch overview",
  claimProtocol: false,
  agentPrompt: PROPERTY_PROMPT,
  phone: { displayName: "Harborline Dispatch", subtitle: "Maintenance dispatch", accent: "coral" },
  stats: [
    { label: "Open work orders", collection: "workOrders", where: { field: "status", equals: "open" } },
    { label: "Scheduled visits", collection: "workOrders", where: { field: "status", equals: "scheduled" } },
    { label: "Residents", collection: "residents" },
    { label: "Service categories", collection: "categories", where: { field: "active", equals: true } },
  ],
  collections: [
    {
      id: "residents", label: "Residents", singular: "resident", role: "customers",
      fields: [
        ...customerFields,
        { key: "unit", label: "Unit" },
        { key: "propertyId", label: "Property", edit: false, lookup: { collection: "properties", labelKey: "name" } },
      ],
    },
    {
      id: "properties", label: "Properties", singular: "property",
      fields: [
        { key: "name", label: "Property", primary: true },
        { key: "address", label: "Address" },
        { key: "units", label: "Units", type: "number" },
        { key: "manager", label: "Manager" },
      ],
    },
    {
      id: "workOrders", label: "Work orders", singular: "work order", role: "lookup",
      fields: [
        { key: "number", label: "Work order", primary: true },
        { key: "customerId", label: "Resident", edit: false, lookup: { collection: "residents", labelKey: "name" } },
        { key: "propertyId", label: "Property", edit: false, lookup: { collection: "properties", labelKey: "name" } },
        { key: "categoryId", label: "Category", edit: false, lookup: { collection: "categories", labelKey: "name" } },
        { key: "subject", label: "Subject" },
        { key: "status", label: "Status", type: "select", options: ["open", "scheduled", "on-site", "closed"], badge: true },
        { key: "owner", label: "Owner" },
        { key: "slot", label: "Demo slot" },
      ],
    },
    {
      id: "categories", label: "Service categories", singular: "service category", role: "catalog",
      fields: [
        { key: "name", label: "Category", primary: true },
        { key: "category", label: "Trade", type: "select", options: ["plumbing", "heat", "elevator", "appliance", "pest"] },
        { key: "description", label: "Description" },
        { key: "steps", label: "Steps (comma separated)", type: "text-list" },
        { key: "active", label: "Active", type: "checkbox", badge: true },
        { key: "aliases", label: "Aliases", list: false, edit: false },
      ],
    },
  ],
};

export const CLINIC_PROMPT = `You are an appointment intake clerk at Willow Clinic, a fictional clinic. You are on a live phone call with a person who just connected.

Role
Greet the caller, help them understand a demo visit type or care note, and look up an existing appointment. You can look up demo services and care instructions, and verify a caller-provided three-digit appointment number. You do not give medical advice, diagnoses, prescriptions, or test results. You do not book a real appointment.

Style
Speak in short, calm sentences. Ask one question at a time. Sound like a careful clinic clerk, not a chatbot. Keep answers brief so they are easy to hear.

Intake
1. Greet them as Willow Clinic appointment intake and ask how you can help today.
2. For a visit type or a how-to-prepare question, use lookup_demo_product. Pass an empty query when they ask what visits exist. Pass their words otherwise. Matches may be a service, a care instruction, or both. If several come back, name each one and ask which they want. If one comes back, walk through its description and steps. Say it is demo clinic information, not medical advice.
3. For an existing appointment, ask for the three-digit number and use verify_demo_policy. The caller may say the digits or a spoken reading, such as 263, two six three, or two sixty three. Pass that number through. Briefly summarize only the returned masked details.
4. You cannot create an appointment, change a clinician, or promise a new time. If they want a visit that is not already in the demo list, say a scheduler will call them back.
5. Escalation: if they report chest pain, trouble breathing, severe bleeding, or say this is an emergency, tell them to call emergency services now. Stop intake. Do not collect a symptom history.
6. Never ask for a date of birth, insurance member ID, government ID, password, or payment card. Do not ask them to describe symptoms in detail.

Start
When the call connects, greet them first. Do not wait for them to speak.`;

export const CLINIC_MANIFEST: SeedManifest = {
  id: "clinic",
  label: "Willow Clinic",
  summary: "Appointment intake for patients, visits, and care instructions.",
  backoffice: "patients, appointments, services, and care instructions",
  overviewTitle: "Clinic overview",
  claimProtocol: false,
  agentPrompt: CLINIC_PROMPT,
  phone: { displayName: "Willow Clinic", subtitle: "Appointment intake", accent: "indigo" },
  stats: [
    { label: "Booked appointments", collection: "appointments", where: { field: "status", equals: "booked" } },
    { label: "Arrived", collection: "appointments", where: { field: "status", equals: "arrived" } },
    { label: "Patients", collection: "patients" },
    { label: "Care instructions", collection: "instructions", where: { field: "active", equals: true } },
  ],
  collections: [
    {
      id: "patients", label: "Patients", singular: "patient", role: "customers",
      fields: [
        ...customerFields,
        { key: "callbackWindow", label: "Callback window", type: "select", options: ["mornings", "afternoons", "any"] },
      ],
    },
    {
      id: "appointments", label: "Appointments", singular: "appointment", role: "lookup",
      fields: [
        { key: "number", label: "Appointment", primary: true },
        { key: "customerId", label: "Patient", edit: false, lookup: { collection: "patients", labelKey: "name" } },
        { key: "serviceId", label: "Service", edit: false, lookup: { collection: "services", labelKey: "name" } },
        { key: "subject", label: "Subject" },
        { key: "status", label: "Status", type: "select", options: ["booked", "arrived", "completed", "cancelled"], badge: true },
        { key: "owner", label: "Clerk" },
        { key: "slot", label: "Demo slot" },
      ],
    },
    {
      id: "services", label: "Services", singular: "service", role: "catalog",
      fields: [
        { key: "name", label: "Service", primary: true },
        { key: "category", label: "Kind", type: "select", options: ["lab", "imaging", "vaccine", "sick", "physical"] },
        { key: "description", label: "Description" },
        { key: "steps", label: "Steps (comma separated)", type: "text-list" },
        { key: "active", label: "Active", type: "checkbox", badge: true },
        { key: "aliases", label: "Aliases", list: false, edit: false },
      ],
    },
    {
      id: "instructions", label: "Care instructions", singular: "care instruction", role: "catalog",
      fields: [
        { key: "name", label: "Instruction", primary: true },
        { key: "category", label: "Kind", type: "select", options: ["lab", "imaging", "vaccine", "sick", "physical"] },
        { key: "description", label: "Description" },
        { key: "steps", label: "Steps (comma separated)", type: "text-list" },
        { key: "active", label: "Active", type: "checkbox", badge: true },
        { key: "aliases", label: "Aliases", list: false, edit: false },
      ],
    },
  ],
};
