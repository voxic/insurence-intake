import path from "node:path";

/** Runtime JSON/transcript root. Override with DATA_DIR on single-instance hosts. */
export function dataRoot() {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
}

export function backofficeSeedPath() {
  return path.join(process.cwd(), "data", "backoffice", "seed.json");
}

export function backofficeStateDir() {
  return path.join(dataRoot(), "backoffice");
}

export function backofficeStatePath() {
  return path.join(backofficeStateDir(), "state.json");
}

export function transcriptDir() {
  return path.join(dataRoot(), "transcripts");
}
