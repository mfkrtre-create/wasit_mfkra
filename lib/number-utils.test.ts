import { describe, expect, it } from "vitest";
import { formatArea, normalizeNumericInput, parseOptionalPositiveDecimal } from "./number-utils";

describe("number utils", () => {
  it("accepts integer and decimal area values", () => {
    expect(parseOptionalPositiveDecimal("344")).toBe(344);
    expect(parseOptionalPositiveDecimal("344.5")).toBe(344.5);
    expect(parseOptionalPositiveDecimal("0.5")).toBe(0.5);
  });

  it("normalizes Arabic digits and decimal separators", () => {
    expect(normalizeNumericInput("٣٤٤٫٥")).toBe("344.5");
    expect(parseOptionalPositiveDecimal("۳۴۴٫۵")).toBe(344.5);
  });

  it("rejects invalid and empty optional values", () => {
    expect(parseOptionalPositiveDecimal("abc")).toBeNull();
    expect(parseOptionalPositiveDecimal("")).toBeNull();
    expect(parseOptionalPositiveDecimal(null)).toBeNull();
  });

  it("formats displayed area without storing formatted strings", () => {
    expect(formatArea(344.5)).toContain("م²");
    expect(formatArea(null)).toBe("غير محدد");
  });
});
