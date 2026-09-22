export const REALTIME_TOOLS = [
  {
    type: "function",
    name: "lookup_demo_product",
    description:
      "Find read-only Acme demo product and coverage information. Product information is illustrative, not a quote or binding coverage.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Product name, line, code, or coverage term." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "verify_demo_policy",
    description:
      "Verify a caller-provided demo policy number and return masked customer and coverage details. Never ask for or return sensitive data.",
    parameters: {
      type: "object",
      properties: { policy_number: { type: "string", description: "The policy number provided by the caller." } },
      required: ["policy_number"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_confirmed_demo_claim",
    description:
      "Create a claim only after verifying the policy, summarizing the claim details, and getting an explicit caller confirmation. Set confirmed to true only after the caller says yes.",
    parameters: {
      type: "object",
      properties: {
        policy_number: { type: "string" },
        loss_date: { type: "string", description: "Loss date in YYYY-MM-DD format." },
        claim_type: { type: "string" },
        description: { type: "string", description: "Brief non-sensitive loss description." },
        severity: { type: "string", enum: ["low", "medium", "high"] },
        confirmed: {
          type: "boolean",
          enum: [true],
          description: "Must be true only after explicit caller confirmation.",
        },
      },
      required: ["policy_number", "loss_date", "claim_type", "description", "severity", "confirmed"],
      additionalProperties: false,
    },
  },
] as const;
