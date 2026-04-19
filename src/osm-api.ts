// Free geocoding & routing fallback using OpenStreetMap.
//
// - Geocode/search/reverse: Nominatim (https://nominatim.openstreetmap.org)
// - Routing/ETA: OSRM public demo (https://router.project-osrm.org)
//
// Nominatim usage policy: max 1 req/s, must send a descriptive User-Agent.
// OSRM demo server: for low-volume use only. Both are fine for a personal MCP.

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";
const UA = "apple-maps-mcp/0.1 (+https://github.com/izecell/apple-maps-mcp)";

let lastNominatimMs = 0;
async function rateLimitNominatim(): Promise<void> {
  const now = Date.now();
  const wait = 1100 - (now - lastNominatimMs);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimMs = Date.now();
}

async function nominatim<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  await rateLimitNominatim();
  const usp = new URLSearchParams({ format: "jsonv2", addressdetails: "1" });
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const url = `${NOMINATIM}${path}?${usp.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Nominatim ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  category?: string;
  importance?: number;
  address?: Record<string, string>;
  boundingbox?: string[];
}

function shapeResults(rs: NominatimResult[]) {
  return rs.map((r) => ({
    name: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    category: r.category,
    type: r.type,
    importance: r.importance,
    address: r.address,
    boundingBox: r.boundingbox?.map(Number),
  }));
}

export interface OsmGeocodeArgs {
  q: string;
  limitToCountries?: string; // ISO 3166-1 alpha-2, comma-separated
  lang?: string;
  limit?: number;
}

export async function osmGeocode(args: OsmGeocodeArgs): Promise<unknown> {
  const rs = await nominatim<NominatimResult[]>("/search", {
    q: args.q,
    countrycodes: args.limitToCountries?.toLowerCase(),
    "accept-language": args.lang,
    limit: args.limit ?? 5,
  });
  return { source: "OpenStreetMap/Nominatim", results: shapeResults(rs) };
}

export interface OsmReverseArgs {
  lat: number;
  lon: number;
  lang?: string;
}

export async function osmReverseGeocode(args: OsmReverseArgs): Promise<unknown> {
  const r = await nominatim<NominatimResult>("/reverse", {
    lat: args.lat,
    lon: args.lon,
    "accept-language": args.lang,
  });
  return {
    source: "OpenStreetMap/Nominatim",
    result: shapeResults([r])[0],
  };
}

export interface OsmSearchArgs {
  q: string;
  limitToCountries?: string;
  lang?: string;
  limit?: number;
  // bounding box: "west,south,east,north" (Nominatim viewbox order)
  viewbox?: string;
  bounded?: boolean;
}

export async function osmSearch(args: OsmSearchArgs): Promise<unknown> {
  const rs = await nominatim<NominatimResult[]>("/search", {
    q: args.q,
    countrycodes: args.limitToCountries?.toLowerCase(),
    "accept-language": args.lang,
    limit: args.limit ?? 10,
    viewbox: args.viewbox,
    bounded: args.bounded ? "1" : undefined,
  });
  return { source: "OpenStreetMap/Nominatim", results: shapeResults(rs) };
}

// --- OSRM routing ---

type OsrmProfile = "driving" | "walking" | "cycling";

export function profileFromTransport(t?: string): OsrmProfile {
  if (t === "Walking" || t === "walking") return "walking";
  if (t === "Cycling" || t === "cycling") return "cycling";
  // OSRM has no transit profile — map to driving and let the caller surface a note.
  return "driving";
}

const TRANSIT_NOTE =
  "Note: OSM/OSRM has no transit routing — used driving instead. Set APPLE_MAPS_AUTH_TOKEN for real transit.";

export function transitNote(t?: string): string | undefined {
  return t === "Transit" || t === "transit" ? TRANSIT_NOTE : undefined;
}

// Parse a "lat,lon" string into the OSRM "lon,lat" form, or return null
// if the string is not a coordinate pair (caller should geocode it instead).
export function parseLatLonToOsrm(s: string): string | null {
  const m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  return `${m[2]},${m[1]}`;
}

export function humanDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Resolve an address-or-"lat,lon" string to "lon,lat" for OSRM.
async function toOsrmCoord(s: string): Promise<string> {
  const parsed = parseLatLonToOsrm(s);
  if (parsed) return parsed;
  const g = (await osmGeocode({ q: s, limit: 1 })) as {
    results: { latitude: number; longitude: number }[];
  };
  const r = g.results[0];
  if (!r) throw new Error(`Could not geocode: ${s}`);
  return `${r.longitude},${r.latitude}`;
}

export interface OsmDirectionsArgs {
  origin: string;
  destination: string;
  transportType?: "Automobile" | "Walking" | "Transit" | "Cycling" | "driving" | "walking" | "cycling";
  alternatives?: boolean;
}

export async function osmDirections(args: OsmDirectionsArgs): Promise<unknown> {
  const profile = profileFromTransport(args.transportType);
  const note = transitNote(args.transportType);
  const from = await toOsrmCoord(args.origin);
  const to = await toOsrmCoord(args.destination);
  const usp = new URLSearchParams({
    overview: "simplified",
    geometries: "geojson",
    steps: "true",
    alternatives: args.alternatives ? "true" : "false",
  });
  const url = `${OSRM}/route/v1/${profile}/${from};${to}?${usp.toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OSRM ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    routes: { distance: number; duration: number; geometry: unknown; legs: unknown[] }[];
  };
  return {
    source: "OSRM",
    profile,
    ...(note ? { note } : {}),
    routes: json.routes.map((r) => ({
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      durationHuman: humanDuration(r.duration),
      geometry: r.geometry,
      legs: r.legs,
    })),
  };
}

export interface OsmEtaArgs {
  origin: string;
  destinations: string[];
  transportType?: "Automobile" | "Walking" | "Transit" | "Cycling" | "driving" | "walking" | "cycling";
}

export async function osmEta(args: OsmEtaArgs): Promise<unknown> {
  const profile = profileFromTransport(args.transportType);
  const note = transitNote(args.transportType);
  const from = await toOsrmCoord(args.origin);
  const tos = await Promise.all(args.destinations.map(toOsrmCoord));
  const coords = [from, ...tos].join(";");
  const usp = new URLSearchParams({
    sources: "0",
    annotations: "duration,distance",
  });
  const url = `${OSRM}/table/v1/${profile}/${coords}?${usp.toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OSRM ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    durations: (number | null)[][];
    distances?: (number | null)[][];
  };
  const durations = json.durations[0].slice(1);
  const distances = json.distances?.[0].slice(1);
  return {
    source: "OSRM",
    profile,
    ...(note ? { note } : {}),
    etas: args.destinations.map((dest, i) => ({
      destination: dest,
      durationSeconds: durations[i],
      durationHuman: durations[i] != null ? humanDuration(durations[i]!) : null,
      distanceMeters: distances?.[i] ?? null,
    })),
  };
}
