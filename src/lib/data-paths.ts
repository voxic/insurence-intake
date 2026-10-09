import path from "node:path";

/** Runtime transcript root. Override with DATA_DIR on single-instance hosts. */
export function dataRoot() {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
}

/** Committed seed for the in-memory backoffice store. Read once per process boot and on reseed. */
export function backofficeSeedPath() {
  return path.join(process.cwd(), "data", "backoffice", "seed.json");
}

export function transcriptDir() {
  return path.join(dataRoot(), "transcripts");
}
