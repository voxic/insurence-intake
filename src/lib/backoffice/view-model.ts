import type { BackofficeState, ClaimStatus, CustomerStatus, Policy, PolicyStatus } from "./types";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

// Badge fills on the cream backoffice cards: default = teal, secondary = dark brown,
// destructive = red, outline = bordered with dark text. Never leave a status on the pale outline
// alone when a filled variant says more.
export const claimStatusVariant: Record<ClaimStatus, BadgeVariant> = { reported: "destructive", reviewing: "outline", approved: "default", closed: "secondary" };
export const customerStatusVariant: Record<CustomerStatus, BadgeVariant> = { active: "default", prospect: "outline", inactive: "secondary" };
export const policyStatusVariant: Record<PolicyStatus, BadgeVariant> = { active: "default", expired: "secondary", cancelled: "destructive" };

const claimTransitions: Record<ClaimStatus, ClaimStatus[]> = { reported: ["reviewing", "closed"], reviewing: ["approved", "closed"], approved: ["closed"], closed: [] };
/** Forward-only claim workflow. Shared by the server guard and the edit form's status options. */
export function nextClaimStatuses(from: ClaimStatus) { return claimTransitions[from]; }

export type PolicyRow = Policy & { customerName: string; productName: string };

/** Policies joined to customer and product names, active first, then newest effective date. */
export function policyRows(data: Pick<BackofficeState, "customers" | "products" | "policies">): PolicyRow[] {
  return data.policies
    .map((policy) => ({
      ...policy,
      customerName: data.customers.find((x) => x.id === policy.customerId)?.name ?? "Unknown customer",
      productName: data.products.find((x) => x.id === policy.productId)?.name ?? "Unknown product",
    }))
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.effectiveDate.localeCompare(a.effectiveDate));
}
