import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * GET /api/health — liveness + config probe.
 * Used by uptime checks and the dev shell to confirm env wiring.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    supabase: isSupabaseConfigured() ? "configured" : "local-only",
  });
}
