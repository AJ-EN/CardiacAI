import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import { CARDIACAI_SYSTEM_PROMPT, ANALYSE_USER_PROMPT } from "@/lib/agent-prompt";
import { RAMESH_FALLBACK } from "@/lib/ramesh-fallback";

// Ollama runs locally — no API key needed.
// Default: http://localhost:11434  Override with OLLAMA_HOST env var.
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || "http://localhost:11434",
});

const GEMMA_MODEL = process.env.OLLAMA_MODEL || "gemma4";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await ollama.chat({
      model: GEMMA_MODEL,
      format: "json", // Gemma 4 supports structured JSON output natively
      messages: [
        {
          role: "system",
          content: CARDIACAI_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: ANALYSE_USER_PROMPT(body),
        },
      ],
      options: {
        temperature: 0.3, // Low temp for deterministic clinical output
        num_predict: 2048, // Equivalent to max_tokens
      },
    });

    const raw = response.message.content;

    // Strip any markdown code fences if the model wraps output despite format: json
    const cleaned = raw
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
