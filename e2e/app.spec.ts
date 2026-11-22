import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("loads the plate model and scrubs time", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?ma=250");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(page.locator("#ma")).toHaveText("250 Ma");
  await expect(page.locator("#period")).toHaveText("Triassic");
  await expect(page.locator("#sg-pos")).toHaveText("42.1°S 98.1°E");

  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.locator("#ma")).toHaveText("Today");
  await expect(page.locator("#sg-pos")).toHaveText("1.3°N 103.8°E");
  await expect(page.locator("#sg-dist")).toHaveText("0 km");
  expect(page.url()).toContain("ma=0");

  await page.locator("#time").fill("750");
  await expect(page.locator("#ma")).toHaveText("750 Ma");
  await expect(page.locator("#sg-note")).toBeVisible();
  await expect(page.getByText("Made by")).toBeAttached();
  expect(errors).toEqual([]);
});

test("canvas actually draws the globe", async ({ page }) => {
  await page.goto("/?ma=0");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  const shot = await page.locator("#globe").screenshot();
  expect(shot.byteLength).toBeGreaterThan(20_000); // a blank canvas compresses to a few kB
});

test("play advances toward today", async ({ page }) => {
  await page.goto("/?ma=300");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(async () => Number(await page.locator("#time").inputValue())).toBeLessThan(290);
  await page.getByRole("button", { name: "Pause" }).click();
});

for (const theme of ["dark", "light"] as const) {
  test(`axe clean (${theme})`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
    if (theme === "light") await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}

test("plate boundaries toggle and legend", async ({ page }) => {
  await page.goto("/?ma=250");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  const btn = page.getByRole("button", { name: "Plate boundaries" });
  await expect(page.getByText("Subduction zone")).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Subduction zone")).toBeVisible();
  expect(page.url()).toContain("b=1");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
  await btn.click();
  expect(page.url()).not.toContain("b=1");
});

test("?b=1 opens with boundaries in the light theme, axe clean", async ({ page }) => {
  await page.goto("/?ma=600&b=1");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(page.getByText("Mid-ocean ridge")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});
