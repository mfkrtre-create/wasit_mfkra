import { afterEach, describe, expect, it, vi } from "vitest";
import { assertOtpRecipientAllowed, getEmailDomain, InvalidProductionEmailError, isPlaceholderEmail } from "./email-policy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OTP recipient email policy", () => {
  it("extracts only safe recipient metadata for logging", () => {
    expect(getEmailDomain("Broker.Name+otp@Gmail.com")).toBe("gmail.com");
  });

  it("detects generated and placeholder recipients", () => {
    expect(isPlaceholderEmail("otp-test-1785669103@example.com")).toBe(true);
    expect(isPlaceholderEmail("broker@test.com")).toBe(true);
    expect(isPlaceholderEmail("placeholder@gmail.com")).toBe(true);
    expect(isPlaceholderEmail("real.broker@gmail.com")).toBe(false);
  });

  it("rejects example.com and test.com OTP recipients in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_MOCK_MODE", "");
    vi.stubEnv("ALLOW_TEST_EMAIL_RECIPIENTS", "");

    expect(() => assertOtpRecipientAllowed("otp-test-1785669103@example.com")).toThrow(InvalidProductionEmailError);
    expect(() => assertOtpRecipientAllowed("broker@test.com")).toThrow(InvalidProductionEmailError);
  });

  it("allows placeholder recipients only in tests or explicit local mock mode", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(assertOtpRecipientAllowed("otp-test-1785669103@example.com")).toBe("otp-test-1785669103@example.com");

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_MOCK_MODE", "true");
    expect(assertOtpRecipientAllowed("broker@test.com")).toBe("broker@test.com");
  });
});
