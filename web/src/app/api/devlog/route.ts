import { NextResponse, type NextRequest } from "next/server";
import { appendFile } from "node:fs/promises";
import path from "node:path";

/**
 * POST /api/devlog — dev-only. Appends one JSON line per measurement to
 * `measurement-log.jsonl` at the repo root so selections/traces are inspectable.
 * Returns 404 in production.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const line =
    JSON.stringify({ at: new Date().toISOString(), ...(body as Record<string, unknown>) }) + "\n";

  try {
    await appendFile(path.join(process.cwd(), "measurement-log.jsonl"), line, "utf8");
  } catch (e) {
    console.warn("[devlog] append failed:", e);
    return NextResponse.json({ ok: false, error: "write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
