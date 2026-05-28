// Shared helpers for custom domain handling — used by both server routes and UI.

export const BREEZY_ROOT_DOMAIN = process.env.BREEZY_ROOT_DOMAIN || "breezy.app";

/**
 * Normalize a user-entered domain:
 * - strip protocol, paths, ports, query
 * - strip leading "www."
 * - lowercase
 * Returns the canonical apex form, e.g. "myapp.com".
 */
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0];
  d = d.split(":")[0];
  d = d.split("?")[0];
  if (d.startsWith("www.")) d = d.slice(4);
  return d;
}

const DOMAIN_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function isValidDomain(d: string): boolean {
  return DOMAIN_RE.test(d);
}

export function validationError(input: string): string | null {
  if (!input.trim()) return "Enter a domain";
  const d = normalizeDomain(input);
  if (!isValidDomain(d)) {
    return "That doesn't look like a valid domain (e.g. myapp.com)";
  }
  // Don't let users claim our own root
  if (d === BREEZY_ROOT_DOMAIN || d.endsWith("." + BREEZY_ROOT_DOMAIN)) {
    return `You can't connect a ${BREEZY_ROOT_DOMAIN} subdomain — use your own domain.`;
  }
  return null;
}

/** True for hosts we serve directly (the Breezy app itself), not custom domains. */
export function isBreezyHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (h.endsWith(".lovable.app")) return true;
  if (h.endsWith(".lovable.dev")) return true;
  if (h === BREEZY_ROOT_DOMAIN || h.endsWith("." + BREEZY_ROOT_DOMAIN)) return true;
  return false;
}

export type DnsTxtAnswer = { name: string; type: number; TTL: number; data: string };
export type DohResponse = { Status: number; Answer?: DnsTxtAnswer[] };

/** Look up TXT records for a host via Cloudflare DoH JSON API. No deps. */
export async function lookupTxt(host: string): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=TXT`;
  const res = await fetch(url, {
    headers: { accept: "application/dns-json" },
  });
  if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
  const json = (await res.json()) as DohResponse;
  if (!json.Answer) return [];
  // TXT data is wrapped in quotes by DoH; some records contain multiple strings.
  return json.Answer.filter((a) => a.type === 16).map((a) =>
    a.data.replace(/^"|"$/g, "").replace(/" "/g, ""),
  );
}
