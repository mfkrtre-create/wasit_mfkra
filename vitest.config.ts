import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".",
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "ui/**/*.test.ts"],
  },
});
