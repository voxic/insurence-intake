type VerifiedPolicy = {
  policyId: string;
  expiresAt: number;
};

type Confirmation = {
  fingerprint: string;
  expiresAt: number;
};

type LiveIntakeCall = {
  expiresAt: number;
  verifiedPolicies: Map<string, VerifiedPolicy>;
  confirmations: Map<string, Confirmation>;
};

const CALL_TTL_MS = 5 * 60 * 1000;
const CONFIRMATION_TTL_MS = 60 * 1000;
const calls = new Map<string, LiveIntakeCall>();

function cleanExpired() {
  const now = Date.now();
  for (const [id, call] of calls) {
    if (call.expiresAt <= now) calls.delete(id);
  }
}

function getCall(callId: string) {
  cleanExpired();
  return calls.get(callId) ?? null;
}

export function createLiveIntakeCall() {
  cleanExpired();
  const id = crypto.randomUUID();
  calls.set(id, {
    expiresAt: Date.now() + CALL_TTL_MS,
    verifiedPolicies: new Map(),
    confirmations: new Map(),
  });
  return id;
}

export function recordVerifiedPolicy(callId: string, policyNumber: string, policyId: string) {
  const call = getCall(callId);
  if (!call) return false;
  call.verifiedPolicies.set(policyNumber.toLowerCase(), {
    policyId,
    expiresAt: Date.now() + CALL_TTL_MS,
  });
  return true;
}

export function hasVerifiedPolicy(callId: string, policyNumber: string, policyId: string) {
  const verified = getCall(callId)?.verifiedPolicies.get(policyNumber.toLowerCase());
  return Boolean(verified && verified.expiresAt > Date.now() && verified.policyId === policyId);
}

export function recordConfirmation(callId: string, fingerprint: string) {
  const call = getCall(callId);
  if (!call) return null;
  const id = crypto.randomUUID();
  call.confirmations.set(id, { fingerprint, expiresAt: Date.now() + CONFIRMATION_TTL_MS });
  return id;
}

export function consumeConfirmation(callId: string, confirmationId: string, fingerprint: string) {
  const call = getCall(callId);
  const confirmation = call?.confirmations.get(confirmationId);
  if (!call || !confirmation || confirmation.expiresAt <= Date.now() || confirmation.fingerprint !== fingerprint) {
    return false;
  }
  call.confirmations.delete(confirmationId);
  return true;
}

export function clearLiveIntakeCallsForTest() {
  calls.clear();
}
