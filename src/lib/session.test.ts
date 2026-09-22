import { describe, expect, it } from "vitest";
import { buildSessionUpdate } from "./session";

describe("Realtime session configuration", () => {
  it("includes the server-mediated live intake tools and keeps PTT behavior", () => {
    const session = buildSessionUpdate(undefined, { pushToTalk: true });

    expect(session.session.turn_detection).toBeNull();
    expect(session.session.tools.map((tool) => tool.name)).toEqual([
      "lookup_demo_product",
      "verify_demo_policy",
      "create_confirmed_demo_claim",
    ]);
    expect(session.session.tools[2]?.parameters.properties.confirmed).toMatchObject({
      enum: [true],
    });
  });
});
