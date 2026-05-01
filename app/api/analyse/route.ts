import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CARDIACAI_SYSTEM_PROMPT, ANALYSE_USER_PROMPT } from "@/lib/agent-prompt";
import { RAMESH_FALLBACK } from "@/lib/ramesh-fallback";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: CARDIACAI_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: ANALYSE_USER_PROMPT(body),
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== "text") throw new Error("Unexpected response type");

    // Strip any markdown code fences if present
    const cleaned = raw.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch (err) {
    console.error("CardiacAI API error:", err);
    // Serve pre-cached Ramesh fallback — demo never breaks on stage
    return NextResponse.json(RAMESH_FALLBACK);
  }
}
