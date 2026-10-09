export async function register() {
  // Seed the in-memory backoffice store when the Node server boots, not on the first request.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSeeded } = await import("@/lib/backoffice/repository");
    ensureSeeded();
  }
}
