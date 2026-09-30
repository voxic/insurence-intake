const ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  o: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function words(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && token !== "and");
}

function asPolicyNumber(value: number) {
  if (!Number.isInteger(value) || value < 100 || value > 999) return null;
  return String(value);
}

function digitWord(token: string) {
  if (/^\d$/.test(token)) return token;
  if (Object.prototype.hasOwnProperty.call(ONES, token)) return String(ONES[token]);
  return null;
}

function under100(tokens: string[]) {
  if (tokens.length === 1) {
    const [token] = tokens;
    if (Object.prototype.hasOwnProperty.call(ONES, token)) return ONES[token];
    if (Object.prototype.hasOwnProperty.call(TEENS, token)) return TEENS[token];
    if (Object.prototype.hasOwnProperty.call(TENS, token)) return TENS[token];
    return null;
  }
  if (tokens.length === 2) {
    const tens = TENS[tokens[0]];
    const ones = ONES[tokens[1]];
    if (tens === undefined || ones === undefined || ones === 0) return null;
    return tens + ones;
  }
  return null;
}

/** Digits, spoken digits, or a natural hundreds reading of a 100–999 policy number. */
export function normalizeSpokenPolicyNumber(input: string) {
  const compact = input.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (/^[1-9]\d{2}$/.test(compact)) return compact;

  const tokens = words(input);
  if (tokens.length === 3 && tokens.every((token) => digitWord(token) !== null)) {
    return asPolicyNumber(Number(tokens.map((token) => digitWord(token)).join("")));
  }

  if (tokens.length >= 2 && tokens[1] === "hundred") {
    const hundreds = ONES[tokens[0]];
    if (hundreds === undefined || hundreds < 1) return null;
    if (tokens.length === 2) return asPolicyNumber(hundreds * 100);
    const rest = under100(tokens.slice(2));
    if (rest === null) return null;
    return asPolicyNumber(hundreds * 100 + rest);
  }

  // "one forty two" / "six forty": the first digit plus the rest of the number.
  if (tokens.length >= 2 && tokens[1] !== "hundred") {
    const head = ONES[tokens[0]];
    const rest = under100(tokens.slice(1));
    if (head !== undefined && head >= 1 && rest !== null && rest >= 10) {
      return asPolicyNumber(head * 100 + rest);
    }
  }

  return null;
}
