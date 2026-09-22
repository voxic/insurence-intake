export type CustomerStatus = "active" | "prospect" | "inactive";
export type ProductLine = "auto" | "home" | "renters" | "pet";
export type PolicyStatus = "active" | "expired" | "cancelled";
export type ClaimStatus = "reported" | "reviewing" | "approved" | "closed";
export type ClaimSeverity = "low" | "medium" | "high";

export type Customer = {
  id: string; name: string; email: string; phone: string; address: string;
  dateOfBirth: string; status: CustomerStatus; createdAt: string; updatedAt: string;
};
export type Product = {
  id: string; code: string; name: string; line: ProductLine; description: string;
  coverages: string[]; deductibles: number[]; active: boolean;
};
export type Policy = {
  id: string; customerId: string; productId: string; number: string; status: PolicyStatus;
  effectiveDate: string; expirationDate: string; coverage: string; deductible: number;
  premium: number; priceVersion: number;
};
export type PricingRule = {
  id: string; productId: string; version: number; active: boolean; effectiveDate: string;
  basePremium: number; minPremium: number; maxPremium: number;
  factors: Record<string, number>;
};
export type ClaimEvent = {
  id: string; timestamp: string; actor: string; type: "note" | "status"; note: string;
  beforeStatus?: ClaimStatus; afterStatus?: ClaimStatus;
};
export type Claim = {
  id: string; number: string; customerId: string; policyId: string; lossDate: string;
  reportedDate: string; type: string; description: string; severity: ClaimSeverity;
  status: ClaimStatus; owner: string; reserve: number; paidAmount: number;
  createdAt: string; updatedAt: string; events: ClaimEvent[];
};
export type BackofficeState = {
  customers: Customer[]; products: Product[]; policies: Policy[];
  pricingRules: PricingRule[]; claims: Claim[];
};
