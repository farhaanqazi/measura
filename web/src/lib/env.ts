import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    GEOCODER_USER_AGENT: z
      .string()
      .min(1)
      // NB: some Overpass mirrors 406 on placeholder UAs (e.g. example.com).
      // A real contact URL keeps us inside their etiquette and unblocked.
      .default("Mozilla/5.0 (compatible; MeasuraBot/0.1; +https://measura.app)"),
    /**
     * Photon (Komoot) is the default geocoder — free, no API key, no IP
     * blocking. Returns GeoJSON FeatureCollection. https://photon.komoot.io
     * Swap to Nominatim (https://nominatim.openstreetmap.org) or a paid
     * provider via env override if you need address details Photon lacks.
     */
    PHOTON_BASE_URL: z
      .string()
      .url()
      .default("https://photon.komoot.io"),
    /**
     * Public Overpass main instance is often overloaded. The kumi.systems
     * mirror is community-run and consistently faster.
     * https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
     */
    OVERPASS_BASE_URL: z
      .string()
      .url()
      .default("https://overpass-api.de/api/interpreter"),
    /**
     * Open-Meteo's free elevation API (no key required). Uses Copernicus DEM 90m
     * for global ground-level elevation. https://open-meteo.com/en/docs/elevation-api
     */
    OPEN_METEO_BASE_URL: z
      .string()
      .url()
      .default("https://api.open-meteo.com"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("Measura"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  },
  runtimeEnv: {
    GEOCODER_USER_AGENT: process.env.GEOCODER_USER_AGENT,
    PHOTON_BASE_URL: process.env.PHOTON_BASE_URL,
    OVERPASS_BASE_URL: process.env.OVERPASS_BASE_URL,
    OPEN_METEO_BASE_URL: process.env.OPEN_METEO_BASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  emptyStringAsUndefined: true,
});

export const isSupabaseConfigured = () =>
  Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
