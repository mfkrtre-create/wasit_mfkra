import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("map page source", () => {
  it("does not include the old fake grid map fallback", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");

    expect(pageSource).not.toContain("خريطة تشغيلية أولية");
    expect(pageSource).not.toContain("bg-[linear-gradient");
    expect(pageSource).not.toContain("style={{ right:");
    expect(pageSource).toContain("RealEstateMap");
  });
});
