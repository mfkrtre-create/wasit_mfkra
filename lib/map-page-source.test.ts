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

  it("gates the app behind login and keeps production UI free of demo/debug state", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");

    expect(pageSource).toContain("return renderPublicAuthShell()");
    expect(pageSource).toContain("سجل الدخول أولاً للوصول إلى بياناتك");
    expect(pageSource).toContain('setWorkspace(seedState)');
    expect(pageSource).not.toContain("window.localStorage");
    expect(pageSource).not.toContain("wasit-mfkra-local-mvp-state");
    expect(pageSource).not.toContain("أبو خالد");
    expect(pageSource).not.toContain("شركة نجد");
    expect(pageSource).not.toContain("سارة العتيبي");
    expect(pageSource).not.toContain("SMTP جاهز");
    expect(pageSource).not.toContain("متغيرات Supabase");
    expect(pageSource).not.toContain("حالة قاعدة البيانات");
    expect(pageSource).not.toContain("غير مدعو");
    expect(pageSource).not.toContain("دعوات فقط");
    expect(pageSource).toContain("مفتوح لأي مستخدم");
  });

  it("protects AI server actions with authenticated requests", () => {
    const extractSource = readFileSync(join(process.cwd(), "app", "api", "extract-property", "route.ts"), "utf8");
    const transcribeSource = readFileSync(join(process.cwd(), "app", "api", "transcribe", "route.ts"), "utf8");
    const authSource = readFileSync(join(process.cwd(), "lib", "app-auth.ts"), "utf8");

    expect(extractSource).toContain("requireAuthenticatedRequest()");
    expect(transcribeSource).toContain("requireAuthenticatedRequest()");
    expect(authSource).toContain("app_sessions");
    expect(authSource).toContain("wasit_session");
    expect(authSource).toContain("سجل الدخول أولاً لاستخدام هذه الخدمة.");
  });

  it("uses server PostgreSQL auth and workspace tables", () => {
    const migrationSource = readFileSync(join(process.cwd(), "db", "migrations", "202608020001_server_auth.sql"), "utf8");
    const migrateScript = readFileSync(join(process.cwd(), "scripts", "migrate.mjs"), "utf8");

    expect(migrationSource).toContain("create table if not exists public.app_users");
    expect(migrationSource).toContain("create table if not exists public.app_sessions");
    expect(migrationSource).toContain("create table if not exists public.workspace_snapshots");
    expect(migrationSource).not.toContain("auth.uid()");
    expect(migrateScript).toContain("202608020001_server_auth.sql");
  });
});
