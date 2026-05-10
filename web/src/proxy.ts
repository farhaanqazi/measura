import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 Proxy convention (formerly `middleware`). Refreshes the
 * Supabase auth session cookies on every matching request so server and
 * client clients stay in sync.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match every request EXCEPT:
     * - _next/static, _next/image (Next internals)
     * - favicon, public asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
