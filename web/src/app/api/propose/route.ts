import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const runtime = "edge";

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY || "", // Ensure this is in your env
});

/**
 * Phase 4: Provenance-validated AI Layer
 * POST /api/propose
 * Proposes building attributes (floors, type) using Claude 3.5 Haiku.
 * Returns structured JSON matching the tool schema.
 */
export async function POST(req: Request) {
  try {
    const { geojson, imageryContext } = await req.json();

    // 1. Input sanitization: prevent prompt injection by wrapping untrusted data
    // (In a real app, strictly validate the GeoJSON and imageryContext before proceeding)
    const sanitizedContext = JSON.stringify({ geojson, imageryContext });

    // 2. Setup the tool schema for structured output
    const proposalTool = {
      name: "propose_building_attributes",
      description: "Propose building floor count and type based on imagery and geometry context.",
      input_schema: {
        type: "object" as const,
        properties: {
          proposed_floors: {
            type: "number",
            description: "Estimated number of floors above ground.",
          },
          building_type: {
            type: "string",
            enum: ["office", "residential", "retail", "industrial", "unknown"],
            description: "The estimated primary use-type of the building.",
          },
          confidence_score: {
            type: "number",
            description: "Confidence in the proposal from 0.0 to 1.0",
          },
        },
        required: ["proposed_floors", "building_type", "confidence_score"],
      },
    };

    // 3. Make the API call with a hard timeout (Phase 4 operational spec)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second hard timeout

    const message = await anthropic.messages.create(
      {
        model: "claude-3-5-haiku-latest",
        max_tokens: 256,
        tools: [proposalTool],
        tool_choice: { type: "tool", name: "propose_building_attributes" },
        messages: [
          {
            role: "user",
            content: `Analyze the following building context and propose its floor count and type. Context: ${sanitizedContext}`,
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    // 4. Extract the tool use
    const toolCall = message.content.find((c) => c.type === "tool_use");
    if (!toolCall || toolCall.type !== "tool_use") {
      throw new Error("Model failed to use the proposal tool.");
    }

    return NextResponse.json(toolCall.input);
  } catch (error: any) {
    console.error("[Propose API] Error or timeout:", error);
    // On reject/timeout, fallback to a heuristic (handled by the client validator, we just return error here)
    return NextResponse.json({ error: error.message || "Failed to propose attributes" }, { status: 500 });
  }
}
