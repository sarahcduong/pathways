import { getServerConfig } from "./config.server";

const CLAUDE_MODEL = "claude-sonnet-4-6";

export function parseJsonFromClaude(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonStr = fenceMatch ? fenceMatch[1]!.trim() : trimmed;
  return JSON.parse(jsonStr);
}

export async function callClaude(prompt: string, maxTokens = 4096): Promise<string> {
  const { claudeApiKey } = getServerConfig();
  if (!claudeApiKey) {
    throw new Error("CLAUDE_API_KEY is not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) {
    throw new Error("Claude API returned no text content");
  }
  return text;
}

export async function callClaudeJson<T>(prompt: string, maxTokens = 4096): Promise<T> {
  const text = await callClaude(
    `${prompt}\n\nReturn only valid JSON. No markdown, no code fences, no preamble.`,
    maxTokens,
  );
  return parseJsonFromClaude(text) as T;
}
