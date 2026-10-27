import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    // software WebGL so the globe renders on machines without a GPU
    launchOptions: {
      // PW_CHROMIUM: use a preinstalled browser (e.g. /opt/pw-browsers/chromium in cloud sessions)
      executablePath: process.env.PW_CHROMIUM || undefined,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
