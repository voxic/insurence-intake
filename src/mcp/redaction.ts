const forbiddenKeys = new Set([
  "ssn", "socialsecuritynumber", "taxid", "itin", "ein", "passport", "driverlicense",
  "drivinglicense", "governmentid", "nationalid", "dateofbirth", "dob", "address",
  "paidamount", "reserve", "premium", "cardnumber", "pan", "cvv", "cvc", "iban",
  "routingnumber", "accountnumber", "paymentmethod", "secret", "password", "apikey",
  "token", "note", "events", "transcript", "callid",
]);

export function maskName(name: string) {
  const [first, last = ""] = name.split(" ");
  return `${first} ${last.slice(0, 1)}.`.trim();
}
export function maskPhone(phone: string) { return `***-***-${phone.replace(/\D/g, "").slice(-4)}`; }
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
export function maskNumber(number: string) {
  // Last four characters would be the entire 3-digit policy number.
  const tail = number.length <= 4 ? number.slice(-1) : number.slice(-4);
  return `••••${tail}`;
}

function isClaimShape(value: Record<string, unknown>) {
  return "claimId" in value || "claimNumber" in value || ("lossDate" in value && "type" in value);
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[_-]/g, "").toLowerCase();
    if (forbiddenKeys.has(normalized)) continue;
    if (normalized === "description" && isClaimShape(value as Record<string, unknown>)) continue;
    output[key] = redact(nested);
  }
  return output;
}
