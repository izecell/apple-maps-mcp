#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  openMapsUrl,
  urlForAddress,
  urlForDirections,
  urlForPin,
  urlForSearch,
} from "./url-scheme.ts";
import {
  directions,
  eta,
  geocode,
  reverseGeocode,
  search,
  searchAutocomplete,
} from "./maps-api.ts";
import {
  osmDirections,
  osmEta,
  osmGeocode,
  osmReverseGeocode,
  osmSearch,
} from "./osm-api.ts";

const HAS_APPLE_TOKEN = !!process.env.APPLE_MAPS_AUTH_TOKEN;

const server = new Server(
  { name: "apple-maps-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const SearchPlace = z.object({ query: z.string().min(1).max(500) });
const ShowAddress = z.object({ address: z.string().min(1).max(500) });
const DropPin = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  label: z.string().max(200).optional(),
});
const Directions = z.object({
  from: z.string().min(1).max(500),
  to: z.string().min(1).max(500),
  mode: z.enum(["driving", "walking", "transit"]).default("driving"),
});
const OpenUrl = z.object({ url: z.string().min(1).max(4096) });

const Geocode = z.object({
  query: z.string().min(1).max(500),
  limitToCountries: z.string().max(200).optional(),
  lang: z.string().max(20).optional(),
  searchLocation: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
});
const ReverseGeocode = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  lang: z.string().max(20).optional(),
});
const Search = z.object({
  query: z.string().min(1).max(500),
  searchLocation: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  searchRegion: z.string().max(100).optional(),
  lang: z.string().max(20).optional(),
  limitToCountries: z.string().max(200).optional(),
  resultTypeFilter: z.string().max(200).optional(),
});
const Autocomplete = Search;
const ApiDirections = z.object({
  origin: z.string().min(1).max(500),
  destination: z.string().min(1).max(500),
  transportType: z.enum(["Automobile", "Walking", "Transit"]).optional(),
  departureDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  requestsAlternateRoutes: z.boolean().optional(),
  avoid: z.string().max(100).optional(),
  lang: z.string().max(20).optional(),
});
const ETA = z.object({
  origin: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
  destinations: z
    .array(z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/))
    .min(1)
    .max(10),
  transportType: z.enum(["Automobile", "Walking", "Transit"]).optional(),
  departureDate: z.string().optional(),
  arrivalDate: z.string().optional(),
});

const tools = [
  {
    name: "open_in_maps_search",
    description:
      "Open Maps.app on this Mac with a search query. Does NOT return results — use 'search' tool for that.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "open_in_maps_address",
    description: "Open Maps.app centred on a specific address.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string" } },
      required: ["address"],
    },
  },
  {
    name: "open_in_maps_pin",
    description: "Drop a pin in Maps.app at the given lat/lon, with optional label.",
    inputSchema: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        label: { type: "string" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "open_in_maps_directions",
    description: "Open Maps.app showing directions from one place to another.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        mode: { type: "string", enum: ["driving", "walking", "transit"] },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "open_maps_url",
    description:
      "Open an arbitrary maps:// or https://maps.apple.com/ URL. Other URL schemes are rejected.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "geocode",
    description:
      "Convert an address or place name to coordinates. Uses Apple Maps Server API if APPLE_MAPS_AUTH_TOKEN is set, otherwise falls back to free OpenStreetMap/Nominatim.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limitToCountries: { type: "string", description: "ISO 3166-1 alpha-2, comma-separated" },
        lang: { type: "string" },
        searchLocation: { type: "string", description: "lat,lon bias" },
      },
      required: ["query"],
    },
  },
  {
    name: "reverse_geocode",
    description:
      "Convert coordinates to a postal address. Uses Apple Maps Server API if token set, else OSM/Nominatim.",
    inputSchema: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        lang: { type: "string" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "search",
    description:
      "Search for places, addresses, or POIs. Returns structured results (name, address, coords, category). Uses Apple Maps Server API if token set, else OSM/Nominatim.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        searchLocation: { type: "string", description: "lat,lon bias" },
        searchRegion: { type: "string", description: "north,west,south,east bbox" },
        lang: { type: "string" },
        limitToCountries: { type: "string" },
        resultTypeFilter: { type: "string", description: "e.g. Poi,Address" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_autocomplete",
    description:
      "Typeahead suggestions for a partial query. Apple Maps Server API if token set; otherwise degrades to a top-5 OSM search.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        searchLocation: { type: "string" },
        searchRegion: { type: "string" },
        lang: { type: "string" },
        limitToCountries: { type: "string" },
        resultTypeFilter: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "directions",
    description:
      "Compute a route with steps, distance, and ETA. Apple Maps Server API if token set, else OSRM (driving/walking/cycling).",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "address or lat,lon" },
        destination: { type: "string" },
        transportType: { type: "string", enum: ["Automobile", "Walking", "Transit"] },
        departureDate: { type: "string" },
        arrivalDate: { type: "string" },
        requestsAlternateRoutes: { type: "boolean" },
        avoid: { type: "string", description: "e.g. Tolls,Highways" },
        lang: { type: "string" },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "eta",
    description:
      "Fast ETA from one origin to up to 10 destinations. Apple Maps Server API if token set, else OSRM table service.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "lat,lon" },
        destinations: {
          type: "array",
          items: { type: "string", description: "lat,lon" },
          minItems: 1,
          maxItems: 10,
        },
        transportType: { type: "string", enum: ["Automobile", "Walking", "Transit"] },
        departureDate: { type: "string" },
        arrivalDate: { type: "string" },
      },
      required: ["origin", "destinations"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: rawArgs } = req.params;
  const args = rawArgs ?? {};
  try {
    switch (name) {
      case "open_in_maps_search": {
        const a = SearchPlace.parse(args);
        const url = urlForSearch(a.query);
        await openMapsUrl(url);
        return { content: [{ type: "text", text: `Opened: ${url}` }] };
      }
      case "open_in_maps_address": {
        const a = ShowAddress.parse(args);
        const url = urlForAddress(a.address);
        await openMapsUrl(url);
        return { content: [{ type: "text", text: `Opened: ${url}` }] };
      }
      case "open_in_maps_pin": {
        const a = DropPin.parse(args);
        const url = urlForPin(a.latitude, a.longitude, a.label);
        await openMapsUrl(url);
        return { content: [{ type: "text", text: `Opened: ${url}` }] };
      }
      case "open_in_maps_directions": {
        const a = Directions.parse(args);
        const url = urlForDirections(a.from, a.to, a.mode);
        await openMapsUrl(url);
        return { content: [{ type: "text", text: `Opened: ${url}` }] };
      }
      case "open_maps_url": {
        const a = OpenUrl.parse(args);
        const url = await openMapsUrl(a.url);
        return { content: [{ type: "text", text: `Opened: ${url}` }] };
      }
      case "geocode": {
        const a = Geocode.parse(args);
        const r = HAS_APPLE_TOKEN
          ? await geocode({
              q: a.query,
              limitToCountries: a.limitToCountries,
              lang: a.lang,
              searchLocation: a.searchLocation,
            })
          : await osmGeocode({
              q: a.query,
              limitToCountries: a.limitToCountries,
              lang: a.lang,
            });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "reverse_geocode": {
        const a = ReverseGeocode.parse(args);
        const r = HAS_APPLE_TOKEN
          ? await reverseGeocode({ lat: a.latitude, lon: a.longitude, lang: a.lang })
          : await osmReverseGeocode({ lat: a.latitude, lon: a.longitude, lang: a.lang });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "search": {
        const a = Search.parse(args);
        const r = HAS_APPLE_TOKEN
          ? await search({
              q: a.query,
              searchLocation: a.searchLocation,
              searchRegion: a.searchRegion,
              lang: a.lang,
              limitToCountries: a.limitToCountries,
              resultTypeFilter: a.resultTypeFilter,
            })
          : await osmSearch({
              q: a.query,
              limitToCountries: a.limitToCountries,
              lang: a.lang,
              viewbox: a.searchRegion, // user supplies "west,south,east,north"
              bounded: !!a.searchRegion,
            });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "search_autocomplete": {
        const a = Autocomplete.parse(args);
        if (!HAS_APPLE_TOKEN) {
          // No native autocomplete in Nominatim; degrade to a small search.
          const r = await osmSearch({
            q: a.query,
            limitToCountries: a.limitToCountries,
            lang: a.lang,
            limit: 5,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { note: "OSM fallback: returning top-5 search results (no native autocomplete).", ...(r as object) },
                  null,
                  2,
                ),
              },
            ],
          };
        }
        const r = await searchAutocomplete({
          q: a.query,
          searchLocation: a.searchLocation,
          searchRegion: a.searchRegion,
          lang: a.lang,
          limitToCountries: a.limitToCountries,
          resultTypeFilter: a.resultTypeFilter,
        });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "directions": {
        const a = ApiDirections.parse(args);
        const r = HAS_APPLE_TOKEN
          ? await directions(a)
          : await osmDirections({
              origin: a.origin,
              destination: a.destination,
              transportType: a.transportType,
              alternatives: a.requestsAlternateRoutes,
            });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      case "eta": {
        const a = ETA.parse(args);
        const r = HAS_APPLE_TOKEN
          ? await eta(a)
          : await osmEta({
              origin: a.origin,
              destinations: a.destinations,
              transportType: a.transportType,
            });
        return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
      }
      default:
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Error: ${msg}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
