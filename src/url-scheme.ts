import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pExecFile = promisify(execFile);

const ALLOWED_PREFIXES = [
  "maps://",
  "https://maps.apple.com/",
  "http://maps.apple.com/",
];

function assertSafeMapsUrl(url: string): void {
  if (typeof url !== "string" || url.length > 4096) {
    throw new Error("URL must be a string ≤4096 chars");
  }
  if (!ALLOWED_PREFIXES.some((p) => url.startsWith(p))) {
    throw new Error(
      `URL must start with one of: ${ALLOWED_PREFIXES.join(", ")}`,
    );
  }
}

export async function openMapsUrl(url: string): Promise<string> {
  assertSafeMapsUrl(url);
  await pExecFile("/usr/bin/open", ["-a", "Maps", url], { timeout: 5000 });
  return url;
}

function buildAppleMapsUrl(params: Record<string, string>): string {
  const usp = new URLSearchParams(params);
  return `https://maps.apple.com/?${usp.toString()}`;
}

export function urlForSearch(query: string): string {
  return buildAppleMapsUrl({ q: query });
}

export function urlForAddress(address: string): string {
  return buildAppleMapsUrl({ address });
}

export function urlForPin(lat: number, lon: number, label?: string): string {
  const params: Record<string, string> = { ll: `${lat},${lon}` };
  if (label) params.q = label;
  return buildAppleMapsUrl(params);
}

export type DirectionsMode = "driving" | "walking" | "transit";

export function urlForDirections(
  from: string,
  to: string,
  mode: DirectionsMode = "driving",
): string {
  const dirflg = mode === "walking" ? "w" : mode === "transit" ? "r" : "d";
  return buildAppleMapsUrl({ saddr: from, daddr: to, dirflg });
}
