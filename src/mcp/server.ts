import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { redact } from "./redaction";
import {
  getClaim,
  getCustomer,
  getPriceIndication,
  getProduct,
  listProducts,
  readResource,
  reseedDemoData,
  searchClaims,
  searchCustomers,
  updateDemoClaim,
  updateDemoCustomer,
  updateDemoPolicy,
  updateDemoPricingRule,
  updateDemoProduct,
} from "./service";
import {
  getClaimInput,
  getCustomerInput,
  getProductInput,
  listProductsInput,
  priceIndicationInput,
  reseedInput,
  searchClaimsInput,
  searchCustomersInput,
  updateClaimInput,
  updateCustomerInput,
  updatePolicyInput,
  updatePricingRuleInput,
  updateProductInput,
} from "./schemas";

const readOnly = { readOnlyHint: true };
const edits = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };
const wipes = { readOnlyHint: false, destructiveHint: true, idempotentHint: true };
const unavailable = { content: [{ type: "text" as const, text: "No matching demo record was found." }], isError: true };
const result = (value: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: (value as { summary?: string }).summary ?? "Demo data retrieved." }],
  structuredContent: value,
});

function tool<T>(operation: (input: T) => Promise<unknown>) {
  return async (input: T) => {
    const value = await operation(input);
    return value === undefined ? unavailable : result(redact(value) as Record<string, unknown>);
  };
}

export const mcpToolNames = [
  "search_demo_customers", "get_demo_customer", "list_demo_products", "get_demo_product",
  "get_demo_price_indication", "search_demo_claims", "get_demo_claim_status",
  "update_demo_customer", "update_demo_product", "update_demo_policy", "update_demo_pricing_rule",
  "update_demo_claim", "reseed_demo_data",
] as const;

export function createMcpServer() {
  const server = new McpServer({ name: "acme-insurance-demo", version: "0.1.0" });
  server.registerTool("search_demo_customers", {
    title: "Search demo customers", description: "Find redacted synthetic customer cards. Results are capped at 10.",
    inputSchema: searchCustomersInput, annotations: readOnly,
  }, tool(searchCustomers));
  server.registerTool("get_demo_customer", {
    title: "Get demo customer", description: "Get a redacted synthetic customer profile with policy and claim references.",
    inputSchema: getCustomerInput, annotations: readOnly,
  }, tool(getCustomer));
  server.registerTool("list_demo_products", {
    title: "List demo products", description: "List synthetic insurance products. Results are capped at 20.",
    inputSchema: listProductsInput, annotations: readOnly,
  }, tool(listProducts));
  server.registerTool("get_demo_product", {
    title: "Get demo product", description: "Get coverage highlights for one synthetic product. Never a binding offer.",
    inputSchema: getProductInput, annotations: readOnly,
  }, tool(getProduct));
  server.registerTool("get_demo_price_indication", {
    title: "Get demo price indication", description: "Get a deterministic synthetic annual range, never a quote or binding offer.",
    inputSchema: priceIndicationInput, annotations: readOnly,
  }, tool(getPriceIndication));
  server.registerTool("search_demo_claims", {
    title: "Search demo claims", description: "Find minimal synthetic claim cards by customer or claim number. Results are capped at 10.",
    inputSchema: searchClaimsInput, annotations: readOnly,
  }, tool(searchClaims));
  server.registerTool("get_demo_claim_status", {
    title: "Get demo claim status", description: "Get a synthetic claim status after supplying its customer ID.",
    inputSchema: getClaimInput, annotations: readOnly,
  }, tool(getClaim));

  // Edits change the shared in-memory demo store that the backoffice UI and the voice
  // bridge read. They are never written to disk and vanish on restart.
  server.registerTool("update_demo_customer", {
    title: "Update demo customer", description: "Change a synthetic customer's name, contact details, or status in the in-memory demo store.",
    inputSchema: updateCustomerInput, annotations: edits,
  }, tool(updateDemoCustomer));
  server.registerTool("update_demo_product", {
    title: "Update demo product", description: "Change a synthetic product's name, description, coverages, deductibles, or active flag in the in-memory demo store.",
    inputSchema: updateProductInput, annotations: edits,
  }, tool(updateDemoProduct));
  server.registerTool("update_demo_policy", {
    title: "Update demo policy", description: "Change a synthetic policy's status, coverage, deductible, premium, or term in the in-memory demo store.",
    inputSchema: updatePolicyInput, annotations: edits,
  }, tool(updateDemoPolicy));
  server.registerTool("update_demo_pricing_rule", {
    title: "Update demo pricing rule", description: "Change a synthetic pricing rule's premiums, factors, or active flag in the in-memory demo store.",
    inputSchema: updatePricingRuleInput, annotations: edits,
  }, tool(updateDemoPricingRule));
  server.registerTool("update_demo_claim", {
    title: "Update demo claim", description: "Move a synthetic claim forward (reported → reviewing → approved → closed) or change its owner or reserve. Requires the claim's customer ID.",
    inputSchema: updateClaimInput, annotations: edits,
  }, tool(updateDemoClaim));
  server.registerTool("reseed_demo_data", {
    title: "Reseed demo data", description: "Discard every runtime edit and reload the active seed, or switch to insurance, support, property, or clinic.",
    inputSchema: reseedInput, annotations: wipes,
  }, tool(reseedDemoData));

  for (const [name, uri, description] of [
    ["demo-catalog", "insurance://demo/catalog", "Compact synthetic product catalog."],
    ["demo-pricing-methodology", "insurance://demo/pricing-methodology", "Synthetic price-indication methodology."],
    ["demo-data-notice", "insurance://demo/data-notice", "Demo data and privacy notice."],
  ] as const) {
    server.registerResource(name, uri, { description, mimeType: "application/json" }, async () => ({
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(await readResource(uri)) }],
    }));
  }
  for (const [name, template] of [
    ["demo-customer-summary", "insurance://demo/customer/{customerId}/summary"],
    ["demo-claim-summary", "insurance://demo/claim/{claimId}/summary"],
  ] as const) {
    server.registerResource(name, new ResourceTemplate(template, { list: undefined }), {
      description: "Redacted, compact synthetic demo record summary.", mimeType: "application/json",
    }, async (uri) => {
      const value = await readResource(uri.toString());
      return {
        contents: [{
          uri: uri.toString(), mimeType: "application/json",
          text: JSON.stringify(value ?? { error: "No matching demo record was found." }),
        }],
      };
    });
  }
  return server;
}
