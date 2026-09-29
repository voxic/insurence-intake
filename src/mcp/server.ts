import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { redact } from "./redaction";
import {
  getClaim,
  getCustomer,
  getPriceIndication,
  getProduct,
  listProducts,
  readResource,
  searchClaims,
  searchCustomers,
} from "./service";
import {
  getClaimInput,
  getCustomerInput,
  getProductInput,
  listProductsInput,
  priceIndicationInput,
  searchClaimsInput,
  searchCustomersInput,
} from "./schemas";

const readOnly = { readOnlyHint: true };
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
