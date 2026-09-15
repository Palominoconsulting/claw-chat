import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "authority.spec.ts",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4329", trace: "off" },
  webServer: {
    command: "npx tsx tests/authority-e2e-server.ts",
    cwd: process.cwd(),
    url: "http://127.0.0.1:4329",
    reuseExistingServer: false,
  },
  reporter: "list",
});
