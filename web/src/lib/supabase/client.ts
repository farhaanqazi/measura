"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "./types";

/**
 * Browser-side Supabase client. Returns null when Supabase env vars are not
 * configured — call sites must handle the local-first / no-cloud case.
 */
export function createClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
