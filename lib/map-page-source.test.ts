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

  it("configures MapLibre with local worker and RTL Arabic text plugin", () => {
    const configSource = readFileSync(join(process.cwd(), "lib", "maplibre-config.ts"), "utf8");
    const mapSource = readFileSync(join(process.cwd(), "components", "RealEstateMap.tsx"), "utf8");
    const pickerSource = readFileSync(join(process.cwd(), "components", "LocationPicker.tsx"), "utf8");

    expect(configSource).toContain("/maplibre-gl-csp-worker.js");
    expect(configSource).toContain("/mapbox-gl-rtl-text.js");
    expect(configSource).toContain("setRTLTextPlugin");
    expect(configSource).toContain("getRTLTextPluginStatus");
    expect(mapSource).toContain("configureMapLibre");
    expect(pickerSource).toContain("configureMapLibre");
  });

  it("keeps AI and utility tools out of the primary sidebar navigation", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const navBlock = pageSource.slice(pageSource.indexOf("const navItems"), pageSource.indexOf("const viewTitles"));

    expect(navBlock).not.toContain('id: "ai"');
    expect(navBlock).not.toContain('id: "calculator"');
    expect(navBlock).not.toContain('id: "reminders"');
    expect(navBlock).not.toContain('id: "notifications"');
    expect(navBlock).not.toContain('id: "sharing"');
    expect(navBlock).not.toContain('id: "trash"');
    expect(pageSource).toContain('type ProfileSection = "settings" | "auth" | "reminders" | "notifications" | "sharing" | "trash"');
    expect(pageSource).toContain("تسجيل صوتي مباشر");
  });
});
