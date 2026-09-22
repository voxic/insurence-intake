import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { backofficeStatePath } from "@/lib/data-paths";
import { getState } from "@/lib/backoffice/repository";

describe("DATA_DIR runtime resolution", () => {
  const original = process.env.DATA_DIR;
  let dir = "";

  afterAll(async () => {
    if (original === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = original;
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("writes backoffice state under DATA_DIR at runtime, not a build-time path", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "acme-data-"));
    process.env.DATA_DIR = dir;
    expect(backofficeStatePath()).toBe(path.join(dir, "backoffice", "state.json"));
    await getState();
    await expect(access(backofficeStatePath())).resolves.toBeUndefined();
  });
});
