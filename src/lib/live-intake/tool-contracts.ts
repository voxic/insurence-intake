export const REALTIME_TOOLS = [
  {
    type: "function",
    name: "lookup_demo_product",
    description:
      "Look up the active demo catalog: insurance products or support help topics, depending on the loaded seed. Each match includes name, swedish_name, line, description, and coverages or steps. An annual_price_range, when present, is demo information, not a quote. When several items match, name each one and ask which they want. When one matches, summarize it.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Product name, line, coverage, or alias in English or Swedish. Pass an empty string to list every active product.",
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
      "Verify a caller-provided three-digit demo number — a policy on the insurance seed, or a support ticket on the support seed — and return masked details. Accept digits (105), spoken digits (one zero five), or a natural reading (one oh five, one hundred five). Do not require a letter prefix. Never ask for or return sensitive data.",
    parameters: {
      type: "object",
      properties: { policy_number: { type: "string", description: "Three-digit policy number as digits or spoken words, such as 105, one zero five, or one oh five." } },
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
