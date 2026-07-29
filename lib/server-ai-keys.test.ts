import { describe, expect, it } from "vitest";
import { getServerAiKey } from "./ai-env";

function restoreEnv(name: "GEMINI_API_KEY" | "GROQ_API_KEY", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe("getServerAiKey", () => {
  it("returns a trimmed server environment value", () => {
    const previousValue = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "  rotated-gemini-key  ";

    expect(getServerAiKey("GEMINI_API_KEY")).toBe("rotated-gemini-key");

    restoreEnv("GEMINI_API_KEY", previousValue);
  });

  it("returns null when the server environment value is missing or blank", () => {
    const previousValue = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    expect(getServerAiKey("GROQ_API_KEY")).toBeNull();

    process.env.GROQ_API_KEY = "   ";
    expect(getServerAiKey("GROQ_API_KEY")).toBeNull();

    restoreEnv("GROQ_API_KEY", previousValue);
  });
});
