import { describe, expect, it } from "vitest";
import { isValidHttpUrl } from "./env-config";

describe("environment configuration validation", () => {
  it("accepts HTTP and HTTPS URLs only", () => {
    expect(isValidHttpUrl("https://example.supabase.co")).toBe(true);
    expect(isValidHttpUrl("http://localhost:54321")).toBe(true);
  });

  it("rejects copied KEY=value strings and non-URL values", () => {
    expect(isValidHttpUrl("NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co")).toBe(false);
    expect(isValidHttpUrl("example.supabase.co")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});
