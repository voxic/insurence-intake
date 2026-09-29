export const REALTIME_TOOLS = [
  {
    type: "function",
    name: "lookup_demo_product",
    description:
      "Find read-only Acme demo product and coverage information. Product information is illustrative, not a quote or binding coverage.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Product name, line, code, or coverage term. Pass an empty string to list every active product. English and Swedish category words and synonyms, such as home insurance or hemförsäkring, are accepted.",
        },
      },
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
    name: "confirm_demo_claim",
    description:
      "Record the caller's explicit yes only after verifying the policy and reading back the complete claim summary. This does not create a claim.",
    parameters: {
      type: "object",
      properties: {
        policy_number: { type: "string" },
        loss_date: { type: "string", description: "Loss date in YYYY-MM-DD format." },
        claim_type: { type: "string" },
        description: { type: "string", description: "Brief non-sensitive loss description." },
        severity: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["policy_number", "loss_date", "claim_type", "description", "severity"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_confirmed_demo_claim",
    description:
      "Create the claim only with the confirmation_id returned by confirm_demo_claim in this live call.",
    parameters: {
      type: "object",
      properties: {
        policy_number: { type: "string" },
        loss_date: { type: "string", description: "Loss date in YYYY-MM-DD format." },
        claim_type: { type: "string" },
        description: { type: "string", description: "Brief non-sensitive loss description." },
        severity: { type: "string", enum: ["low", "medium", "high"] },
        confirmation_id: { type: "string", description: "Server-issued confirmation for these exact details." },
      },
      required: ["policy_number", "loss_date", "claim_type", "description", "severity", "confirmation_id"],
      additionalProperties: false,
    },
  },
] as const;
