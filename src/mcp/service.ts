import { getState } from "@/lib/backoffice/repository";
import { normalizeSpokenPolicyNumber } from "@/lib/policy-number";
import type { Claim, Customer, Product } from "@/lib/backoffice/types";
import { maskEmail, maskName, maskNumber, maskPhone, redact } from "./redaction";
import {
  claimCardSchema,
  customerCardSchema,
  getClaimInput,
  getCustomerInput,
  getProductInput,
  listProductsInput,
  priceIndicationInput,
  productCardSchema,
  searchClaimsInput,
  searchCustomersInput,
} from "./schemas";

const notice = "Demo data only. This is not a quote, binding offer, coverage decision, or claim decision.";
const sortById = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
const payload = <T extends Record<string, unknown>>(value: T) => redact(value) as T;

function customerCard(customer: Customer) {
  return customerCardSchema.parse({
    customerId: customer.id, name: maskName(customer.name), phone: maskPhone(customer.phone),
    email: maskEmail(customer.email), status: customer.status,
  });
}
function productCard(product: Product) {
  return productCardSchema.parse({
    productId: product.id, name: product.name, lineOfBusiness: product.line,
    active: product.active, coverages: product.coverages,
  });
}
function claimCard(claim: Claim) {
  return claimCardSchema.parse({
    claimId: claim.id, claimNumber: maskNumber(claim.number), customerId: claim.customerId,
    status: claim.status, type: claim.type, lossDate: claim.lossDate,
  });
}

export async function searchCustomers(input: unknown) {
  const { name, phoneLast4, policyNumber, limit } = searchCustomersInput.parse(input);
  const state = await getState();
  const wantedPolicy = policyNumber ? normalizeSpokenPolicyNumber(policyNumber) : null;
  const policyCustomers = new Set(state.policies
    .filter((policy) => !policyNumber || (wantedPolicy !== null && normalizeSpokenPolicyNumber(policy.number) === wantedPolicy))
    .map((policy) => policy.customerId));
  const result = sortById(state.customers).filter((customer) =>
    (!name || customer.name.toLowerCase().includes(name.toLowerCase()))
    && (!phoneLast4 || customer.phone.replace(/\D/g, "").endsWith(phoneLast4))
    && (!policyNumber || policyCustomers.has(customer.id)),
  ).slice(0, limit).map(customerCard);
  return payload({ customers: result, summary: `${result.length} matching demo customer${result.length === 1 ? "" : "s"} found.` });
}

export async function getCustomer(input: unknown) {
  const { customerId } = getCustomerInput.parse(input);
  const state = await getState();
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return undefined;
  const policies = state.policies.filter((policy) => policy.customerId === customer.id).map((policy) => ({
    policyId: policy.id, policyNumber: maskNumber(policy.number), productId: policy.productId,
    status: policy.status, coverage: policy.coverage, deductible: policy.deductible,
  }));
  const claims = state.claims.filter((claim) => claim.customerId === customer.id).map(claimCard);
  return payload({
    customer: customerCard(customer), policies, claims,
    summary: `Redacted demo customer profile for ${customerCard(customer).name}.`,
  });
}

export async function listProducts(input: unknown) {
  const { lineOfBusiness, limit } = listProductsInput.parse(input);
  const state = await getState();
  const products = sortById(state.products)
    .filter((product) => !lineOfBusiness || product.line === lineOfBusiness)
    .slice(0, limit).map(productCard);
  return payload({ products, summary: `${products.length} demo product${products.length === 1 ? "" : "s"} listed.` });
}

export async function getProduct(input: unknown) {
  const { productId } = getProductInput.parse(input);
  const product = (await getState()).products.find((item) => item.id === productId);
  if (!product) return undefined;
  return payload({
    product: productCard(product), description: product.description, deductibles: product.deductibles,
    disclaimer: notice, summary: `${product.name} is a synthetic demo product, not a binding offer.`,
  });
}

export async function getPriceIndication(input: unknown) {
  const { customerId, productId, coverageOptions } = priceIndicationInput.parse(input);
  const state = await getState();
  if (customerId && !state.customers.some((customer) => customer.id === customerId)) return undefined;
  const product = state.products.find((item) => item.id === productId);
  const rule = state.pricingRules.find((item) => item.productId === productId && item.active);
  if (!product || !rule) return undefined;
  const factor = coverageOptions?.factor ?? "standard";
  const multiplier = rule.factors[factor];
  if (!multiplier) return undefined;
  const annual = Math.min(rule.maxPremium, Math.max(rule.minPremium, rule.basePremium * multiplier));
  const range = { low: Math.round(annual * 0.9), high: Math.round(annual * 1.1) };
  return payload({
    indication: true, productId, annualRange: range, currency: "USD", factor, effectiveDate: rule.effectiveDate,
    ruleVersion: rule.version, disclaimer: notice,
    summary: `Synthetic annual indication is $${range.low} to $${range.high}; it is not a quote.`,
  });
}

export async function searchClaims(input: unknown) {
  const { customerId, claimNumber, status, limit } = searchClaimsInput.parse(input);
  const claims = sortById((await getState()).claims).filter((claim) =>
    (!customerId || claim.customerId === customerId)
    && (!claimNumber || claim.number.toLowerCase().includes(claimNumber.toLowerCase()))
    && (!status || claim.status === status),
  ).slice(0, limit).map(claimCard);
  return payload({ claims, summary: `${claims.length} matching demo claim${claims.length === 1 ? "" : "s"} found.` });
}

export async function getClaim(input: unknown) {
  const { claimId, customerId } = getClaimInput.parse(input);
  const claim = (await getState()).claims.find((item) => item.id === claimId && item.customerId === customerId);
  if (!claim) return undefined;
  return payload({
    claim: claimCard(claim),
    timeline: claim.events.map((event) => ({ date: event.timestamp, type: event.type, status: event.afterStatus })),
    nextAction: claim.status === "closed" ? "No further demo claim action is available." : "A demo claims specialist will review the next step.",
    disclaimer: "Demo claim status only. No claim decision, payment, or update can be made here.",
    summary: `Demo claim ${maskNumber(claim.number)} is ${claim.status}.`,
  });
}

export async function readResource(uri: string) {
  const state = await getState();
  if (uri === "insurance://demo/catalog") {
    return payload({ products: state.products.map(productCard), disclaimer: notice });
  }
  if (uri === "insurance://demo/pricing-methodology") {
    return payload({ effectiveDate: "2026-01-01", methodology: "Synthetic base premium multiplied by a fixture factor and bounded by fixture limits.", disclaimer: notice });
  }
  if (uri === "insurance://demo/data-notice") {
    return payload({ fixture: "data/backoffice/seed.json", purpose: "Synthetic, read-only insurance demo data.", pii: "Contact details and policy/claim numbers are masked." });
  }
  const customerMatch = /^insurance:\/\/demo\/customer\/(cus_[a-z0-9_-]+)\/summary$/.exec(uri);
  if (customerMatch) return getCustomer({ customerId: customerMatch[1] });
  const claimMatch = /^insurance:\/\/demo\/claim\/(clm_[a-z0-9_-]+)\/summary$/.exec(uri);
  if (claimMatch) {
    const claim = state.claims.find((item) => item.id === claimMatch[1]);
    return claim ? getClaim({ claimId: claim.id, customerId: claim.customerId }) : undefined;
  }
  return undefined;
}
