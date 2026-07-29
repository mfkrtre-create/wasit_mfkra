export type AiKeyName = "GROQ_API_KEY" | "GEMINI_API_KEY";

export function getServerAiKey(keyName: AiKeyName) {
  const envValue = process.env[keyName]?.trim();
  return envValue || null;
}
