import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
const dir = ".artifacts/context-picker-screenshots";
test.beforeAll(() => {
  mkdirSync(dir, { recursive: true });
});
async function open(page: import("@playwright/test").Page, mobile = false) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore on my own" }).click();
  if (mobile) await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Browse wiki & skills" }).click();
  await expect(
    page.getByRole("heading", { name: "Browse wiki & skills." }),
  ).toBeVisible();
}
test("desktop screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await page
    .getByRole("button", { name: /^What the harbor guide covers/ })
    .click();
  await page.screenshot({ path: `${dir}/desktop-1280x800.png` });
});
test("mobile 390x844 screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, true);
  await page.screenshot({ path: `${dir}/mobile-390x844.png` });
});
test("mobile 320x568 screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, true);
  await page.screenshot({ path: `${dir}/mobile-320x568.png` });
});
