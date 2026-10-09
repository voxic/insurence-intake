import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { backofficeSeedPath, transcriptDir } from "@/lib/data-paths";
import { getState, resetState, updateCustomer } from "@/lib/backoffice/repository";

describe("DATA_DIR runtime resolution", () => {
  const original = process.env.DATA_DIR;
  let dir = "";

  afterAll(async () => {
    if (original === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = original;
    if (dir) await rm(dir, { recursive: true, force: true });
    await resetState();
  });

  it("points transcripts at DATA_DIR at runtime while the seed stays in the repo", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "acme-data-"));
    process.env.DATA_DIR = dir;
    expect(transcriptDir()).toBe(path.join(dir, "transcripts"));
    expect(backofficeSeedPath()).toBe(path.join(process.cwd(), "data", "backoffice", "seed.json"));
  });

  it("never writes backoffice state to disk, even after an edit", async () => {
    await getState();
    await updateCustomer("cus_ada", { status: "inactive" });
    expect(await readdir(dir)).toEqual([]);
  });
});
