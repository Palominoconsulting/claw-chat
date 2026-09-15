import { expect, test } from "@playwright/test";
test("chat → project → parallel stage → review → explicit next start", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good work. Great claws." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page
    .getByRole("checkbox", { name: "Select message m1", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Select message m3", exact: true })
    .check();
  await page.getByRole("button", { name: "Preview excerpts" }).click();
  await expect(
    page.getByRole("heading", { name: "Exactly what you’re saving" }),
  ).toBeVisible();
  await page.getByLabel("Project name").fill("Synthetic harbor review");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep the important parts." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Promote to long-term" }).click();
  await expect(
    page.getByRole("button", { name: "Make short-term" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await page.getByRole("button", { name: "+ Add stage", exact: true }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  const start = page.getByRole("button", { name: "Preview & start stage" });
  await expect(start.nth(1)).toBeDisabled();
  await start.first().click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.getByRole("button", { name: "Start simulated stage" }).click();
  await expect(
    page.getByText("completed · Separate observations from assumptions"),
  ).toBeVisible();
  await expect(start).toBeDisabled();
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I examined this output against its acceptance criteria.",
    })
    .nth(0)
    .check();
  await page
    .getByRole("checkbox", {
      name: "I examined this output against its acceptance criteria.",
    })
    .nth(1)
    .check();
  await page
    .getByLabel("Proposed decision")
    .fill(
      "Use the reviewed observations for the draft; retain all limitations.",
    );
  await page.getByRole("button", { name: "Save new revision" }).click();
  await page
    .getByRole("checkbox", {
      name: "I examined this output against its acceptance criteria.",
    })
    .nth(0)
    .check();
  await page
    .getByRole("checkbox", {
      name: "I examined this output against its acceptance criteria.",
    })
    .nth(1)
    .check();
  await page
    .getByLabel("Review note")
    .fill(
      "Read both simulated outputs and their acceptance criteria. No real-world verification claimed.",
    );
  await page.getByRole("button", { name: "Approve revision 2" }).click();
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await expect(
    page.getByText("Approval recorded. Successor has not started."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Not dispatched · Cite supporting context and flag assumptions",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview & start stage" }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.getByRole("button", { name: "Start simulated stage" }).click();
  await expect(
    page.getByText("completed · Cite supporting context and flag assumptions"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page.getByRole("button", { name: "Preview export" }).click();
  await expect(
    page.getByRole("heading", { name: "Export preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel export" }).click();
  await page
    .getByRole("button", { name: "Archive project", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm archive" }).click();
  await page.reload();
  await page.getByLabel("Filter projects").selectOption("archived");
  await page
    .getByRole("button", { name: "Synthetic harbor review Long-term context" })
    .click();
  await expect(
    page.getByRole("button", { name: "Restore project" }),
  ).toBeVisible();
});
test("large transcript stays bounded; HTML remains inert; theme and mascot preferences persist", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Shoreline access notes Incomplete lineage" })
    .click();
  await expect(page.locator(".message")).toHaveCount(50);
  await page.getByRole("button", { name: "Next 50" }).click();
  await expect(page.locator(".message")).toHaveCount(50);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.getByRole("button", { name: "Lobster encouragement: on" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Lobster encouragement: off" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page
    .getByLabel("Try the conversation")
    .fill('<img src=x onerror="window.__injected=true">');
  await page.getByRole("button", { name: "Send demo message" }).click();
  await expect(
    page.locator(".message-body p").filter({ hasText: "<img src=x onerror=" }),
  ).toBeVisible();
  expect(await page.evaluate(() => "__injected" in window)).toBe(false);
});
test("mobile panels are keyboard accessible and reduced motion has no animations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(page.getByLabel("Try the conversation")).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Conversations", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".button")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
});
