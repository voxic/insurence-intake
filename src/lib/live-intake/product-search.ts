import type { Product } from "@/lib/backoffice/types";

// Filler around a catalog question. Category words live on each product in the seed.
const GENERIC_PRODUCT_TOKENS = new Set([
  "a", "about", "acme", "all", "alla", "allt", "alternativ", "am", "an", "and", "any", "anything", "are", "att", "av",
  "available", "be", "behöver", "berätta", "buy", "can", "catalog", "catalogue", "could", "demo", "det", "do", "does",
  "du", "eller", "en", "era", "erbjuda", "erbjuder", "ett", "everything", "exist", "exists", "finns", "for", "från",
  "för", "försäkring", "försäkringar", "försäkringstyp", "försäkringstyper", "få", "get", "got", "har", "have",
  "hej", "hela", "hello", "help", "hi", "hjälp", "hjälpa", "i", "in", "info", "information", "insurance",
  "insurances", "interested", "intresserad", "is", "it", "jag", "just", "kan", "katalog", "kind", "kinds", "know",
  "köpa", "like", "list", "lista", "me", "mer", "mig", "min", "mina", "mitt", "more", "my", "ni", "now", "nu",
  "någon", "något", "några", "och", "of", "offer", "offering", "offerings", "offers", "olika", "om", "on", "options",
  "or", "our", "please", "product", "products", "produkt", "produkter", "på", "sell", "snälla", "som", "sortiment",
  "specific", "specifika", "säljer", "tack", "teckna", "tell", "that", "the", "there", "this", "to", "typ", "type",
  "types", "typer", "utbud", "vad", "vilka", "vilken", "vilket", "vill", "våra", "want", "we", "what", "which",
  "with", "would", "you", "your", "är",
]);

// Words in a product description that describe every product rather than one.
const DESCRIPTION_FILLER = new Set([
  ...GENERIC_PRODUCT_TOKENS, "because", "benefit", "caused", "cover", "coverage", "deductible", "everyday", "fictional",
  "fixed", "has", "including", "none", "not", "personal", "protection", "swedish", "without",
]);

// A query token matches a term when it is the term plus one of these endings.
// English: plural. Swedish: definite, plural, and a trailing "försäkring" compound (kattförsäkring, husdjursförsäkring).
const EN_ENDINGS = ["s", "es"];
const SV_ENDINGS = ["n", "s", "en", "et", "ar", "er", "or", "ns", "ens", "ets", "arna", "erna", "orna"];
const SV_COMPOUNDS = ["försäkring", "försäkringar", "försäkringen", "försäkringarna"].flatMap((word) => [word, `s${word}`]);

type Lang = "en" | "sv";
// Terms from name, line, coverages, and aliases decide a match; description words only break a miss.
type Tier = 2 | 1;
type Term = { text: string; words: string[]; lang: Lang; tier: Tier };

function tokenize(text: string) {
  return text.toLowerCase().split(/[^a-z0-9åäö]+/u).filter(Boolean);
}

function term(text: string, lang: Lang, tier: Tier): Term | null {
  const words = tokenize(text);
  return words.length > 0 && words.join("").length >= 3 ? { text: words.join(" "), words, lang, tier } : null;
}

function productTerms(product: Product): Term[] {
  const primary = [
    ...[product.name, product.line, ...product.coverages, ...(product.aliases?.en ?? [])].map((text) => term(text, "en", 2)),
    ...(product.aliases?.sv ?? []).map((text) => term(text, "sv", 2)),
  ];
  const fallback = tokenize(product.description)
    .filter((word) => word.length >= 4 && !DESCRIPTION_FILLER.has(word))
    .map((word) => term(word, "en", 1));
  return [...primary, ...fallback].filter((item): item is Term => item !== null);
}

function wordMatches(token: string, word: string, lang: Lang, allowEndings: boolean) {
  if (token === word) return true;
  if (!token.startsWith(word)) return false;
  const rest = token.slice(word.length);
  const endings = lang === "sv" ? [...SV_ENDINGS, ...SV_COMPOUNDS] : EN_ENDINGS;
  return allowEndings && endings.includes(rest);
}

function termMatches(tokens: string[], item: Term) {
  const allowEndings = item.tier === 2;
  return tokens.some((_, start) =>
    item.words.every((word, offset) => {
      const token = tokens[start + offset];
      return token !== undefined && wordMatches(token, word, item.lang, allowEndings && offset === item.words.length - 1);
    }),
  );
}

export function isGenericCatalogQuery(query: string) {
  return tokenize(query).every((token) => GENERIC_PRODUCT_TOKENS.has(token));
}

function containsRun(outer: string[], inner: string[]) {
  return outer.some((_, start) => inner.every((word, offset) => outer[start + offset] === word));
}

// Matching rule: tokenize the utterance; a product matches when one of its terms appears as a
// run of whole words (allowing a plural, definite, or -försäkring ending on the last word).
// A match loses only to a longer phrase that contains it, or to the same words on a stronger
// tier, so "full coverage auto" returns Auto Full alone while "home and car insurance" keeps
// both lines.
export function matchProducts(products: Product[], query: string) {
  if (isGenericCatalogQuery(query)) return products;
  const tokens = tokenize(query);
  const hits = products
    .map((product) => ({ product, matched: productTerms(product).filter((item) => termMatches(tokens, item)) }))
    .filter((hit) => hit.matched.length > 0);
  const all = hits.flatMap((hit) => hit.matched);
  const dominated = (item: Term) =>
    all.some(
      (other) =>
        containsRun(other.words, item.words) &&
        (other.words.length > item.words.length || other.tier > item.tier),
    );
  return hits.filter((hit) => hit.matched.some((item) => !dominated(item))).map((hit) => hit.product);
}
