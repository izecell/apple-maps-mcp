// Apple Maps Server API client.
// Docs: https://developer.apple.com/documentation/applemapsserverapi
//
// Flow:
//   1. Caller supplies an Auth Token JWT (signed with their MapKit private key) via env.
//   2. We exchange it for a short-lived Access Token at GET /v1/token.
//   3. We cache the Access Token until 60s before expiry and reuse it.

const BASE = "https://maps-api.apple.com";

interface AccessToken {
  token: string;
  expiresAtMs: number;
}

let cached: AccessToken | null = null;

function getAuthToken(): string {
  const t = process.env.APPLE_MAPS_AUTH_TOKEN;
  if (!t) {
    throw new Error(
      "APPLE_MAPS_AUTH_TOKEN env var is required for Apple Maps Server API tools. " +
        "See README for how to generate one.",
    );
  }
  return t;
}

async function refreshAccessToken(): Promise<AccessToken> {
  const auth = getAuthToken();
  const res = await fetch(`${BASE}/v1/token`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Apple Maps token exchange failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { accessToken: string; expiresInSeconds: number };
  return {
    token: json.accessToken,
    expiresAtMs: Date.now() + (json.expiresInSeconds - 60) * 1000,
  };
}

async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAtMs) return cached.token;
  cached = await refreshAccessToken();
  return cached.token;
}

async function apiGet<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const url = `${BASE}${path}?${usp.toString()}`;
  const token = await getAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // token might have expired between cache check and request — retry once
    cached = null;
    const token2 = await getAccessToken();
    const res2 = await fetch(url, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    if (!res2.ok) {
      const body = await res2.text().catch(() => "");
      throw new Error(`Apple Maps API ${res2.status}: ${body.slice(0, 300)}`);
    }
    return (await res2.json()) as T;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apple Maps API ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface GeocodeArgs {
  q: string;
  limitToCountries?: string; // ISO 3166-1 alpha-2, comma-separated
  lang?: string;
  searchLocation?: string; // "lat,lon" bias
}

export async function geocode(args: GeocodeArgs): Promise<unknown> {
  return apiGet("/v1/geocode", {
    q: args.q,
    limitToCountries: args.limitToCountries,
    lang: args.lang,
    searchLocation: args.searchLocation,
  });
}

export interface ReverseGeocodeArgs {
  lat: number;
  lon: number;
  lang?: string;
}

export async function reverseGeocode(args: ReverseGeocodeArgs): Promise<unknown> {
  return apiGet("/v1/reverseGeocode", {
    loc: `${args.lat},${args.lon}`,
    lang: args.lang,
  });
}

export interface SearchArgs {
  q: string;
  searchLocation?: string;
  searchRegion?: string; // "north,west,south,east"
  lang?: string;
  limitToCountries?: string;
  resultTypeFilter?: string; // e.g. "Poi,Address"
  includePoiCategories?: string;
}

export async function search(args: SearchArgs): Promise<unknown> {
  return apiGet("/v1/search", {
    q: args.q,
    searchLocation: args.searchLocation,
    searchRegion: args.searchRegion,
    lang: args.lang,
    limitToCountries: args.limitToCountries,
    resultTypeFilter: args.resultTypeFilter,
    includePoiCategories: args.includePoiCategories,
  });
}

export interface AutocompleteArgs {
  q: string;
  searchLocation?: string;
  searchRegion?: string;
  lang?: string;
  limitToCountries?: string;
  resultTypeFilter?: string;
}

export async function searchAutocomplete(args: AutocompleteArgs): Promise<unknown> {
  return apiGet("/v1/searchAutocomplete", {
    q: args.q,
    searchLocation: args.searchLocation,
    searchRegion: args.searchRegion,
    lang: args.lang,
    limitToCountries: args.limitToCountries,
    resultTypeFilter: args.resultTypeFilter,
  });
}

export interface DirectionsArgs {
  origin: string; // address or "lat,lon"
  destination: string;
  transportType?: "Automobile" | "Walking" | "Transit";
  arrivalDate?: string; // ISO
  departureDate?: string; // ISO
  lang?: string;
  requestsAlternateRoutes?: boolean;
  avoid?: string; // "Tolls,Highways"
}

export async function directions(args: DirectionsArgs): Promise<unknown> {
  return apiGet("/v1/directions", {
    origin: args.origin,
    destination: args.destination,
    transportType: args.transportType,
    arrivalDate: args.arrivalDate,
    departureDate: args.departureDate,
    lang: args.lang,
    requestsAlternateRoutes: args.requestsAlternateRoutes,
    avoid: args.avoid,
  });
}

export interface EtaArgs {
  origin: string; // "lat,lon"
  destinations: string[]; // up to 10 "lat,lon"
  transportType?: "Automobile" | "Walking" | "Transit";
  arrivalDate?: string;
  departureDate?: string;
}

export async function eta(args: EtaArgs): Promise<unknown> {
  return apiGet("/v1/etas", {
    origin: args.origin,
    destinations: args.destinations.join("|"),
    transportType: args.transportType,
    arrivalDate: args.arrivalDate,
    departureDate: args.departureDate,
  });
}
