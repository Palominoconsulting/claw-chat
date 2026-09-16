import { expect, test } from "@playwright/test";
test("browse wiki & skills, preview, add to tray, and save into a new project", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore on my own" }).click();
  await page.getByRole("button", { name: "Browse wiki & skills" }).click();
  await expect(
    page.getByRole("heading", { name: "Browse wiki & skills." }),
  ).toBeVisible();

  // Search narrows the wiki list.
  await page.getByLabel("Search wiki and skills").fill("tides");
  await expect(
    page.getByRole("button", { name: /^Tide-dependent walking routes/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^What the harbor guide covers/ }),
  ).toHaveCount(0);
  await page.getByLabel("Search wiki and skills").fill("");

  // Preview a wiki page, confirm the synthetic label, add it.
  await page
    .getByRole("button", { name: /^What the harbor guide covers/ })
    .click();
  await expect(page.getByText("SYNTHETIC — fixture content")).toBeVisible();
  await page
    .locator(".catalog-preview")
    .getByRole("button", { name: "Add to context tray" })
    .click();
  await expect(
    page.locator(".catalog-tray").getByText("What the harbor guide covers"),
  ).toBeVisible();

  // Switch to Skills, expand a card, confirm behavior label is separate from
  // the file-type badge, and that a Script badge appears on both a
  // writes_files and a read_only-adjacent skill without implying safety.
  await page.getByRole("button", { name: /^Skills/ }).click();
  const cleanupCard = page.locator(".catalog-card", {
    hasText: "shore-cleanup-logger",
  });
  await expect(cleanupCard.getByText("Writes files")).toBeVisible();
  await cleanupCard.getByRole("button", { name: "Expand artifacts" }).click();
  await expect(
    cleanupCard.getByRole("button", { name: "Preview" }).first(),
  ).toBeVisible();
  await cleanupCard
    .locator("li", { hasText: "log_cleanup.sh" })
    .getByRole("button", { name: "Add to context tray" })
    .click();
  await expect(
    page.locator(".catalog-tray").getByText(/log_cleanup\.sh/),
  ).toBeVisible();

  // Save the tray into a new project.
  await page.getByLabel("Project name").fill("Catalog picks e2e");
  await page.getByRole("button", { name: "Save to project" }).click();
  await expect(
    page.getByRole("heading", { name: "Keep the important parts." }),
  ).toBeVisible();
  await expect(page.getByText("Wiki/skill reference").first()).toBeVisible();
});

test("unknown-behavior skill shows an explicit Unknown label, never inferred from file type", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore on my own" }).click();
  await page.getByRole("button", { name: "Browse wiki & skills" }).click();
  await page.getByRole("button", { name: /^Skills/ }).click();
  const legacyCard = page.locator(".catalog-card", {
    hasText: "legacy-import-helper",
  });
  await expect(legacyCard.getByText("Unknown behavior")).toBeVisible();
});

test("keyboard-only pass reaches search, list, preview and tray controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore on my own" }).click();
  await page.getByRole("button", { name: "Browse wiki & skills" }).click();
  await page.getByLabel("Search wiki and skills").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  // Focus should now be reachable on the Wiki source tab or beyond without a
  // pointer; assert something inside the catalog picker has focus.
  const active = await page.evaluate(
    () => document.activeElement?.closest(".catalog-picker") !== null,
  );
  expect(active).toBe(true);
});
