import { expect, test } from "@playwright/test";

test("review prerequisites are visibly required and explain disabled actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("checkbox", { name: "Select message m1", exact: true })
    .check();
  await page.getByRole("button", { name: "Preview excerpts" }).click();
  await page.getByLabel("Project name").fill("Required review fields practice");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await page.getByRole("button", { name: "Preview & start stage" }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.getByRole("button", { name: "Start simulated stage" }).click();
  await expect(
    page.getByText("completed · Separate observations from assumptions"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  const note = page.getByLabel("Review note", { exact: true });
  const approve = page.getByRole("button", { name: "Approve revision 1" });
  const changes = page.getByRole("button", {
    name: "Request changes",
    exact: true,
  });
  const reject = page.getByRole("button", { name: "Reject", exact: true });
  const requirements = page.getByRole("status", {
    name: "Review requirements",
  });
  await expect(note).toHaveAttribute("aria-required", "true");
  await expect(note).toHaveAttribute("required", "");
  await expect(page.getByText("* Required", { exact: true })).toBeVisible();
  await expect(requirements).toContainText("Add the required review note.");
  await expect(requirements).toContainText(
    "Confirm you examined all 2 outputs.",
  );
  await expect(approve).toBeDisabled();
  await note.fill("I examined the synthetic output and its limits.");
  await expect(requirements).not.toContainText("Add the required review note.");
  await expect(approve).toBeDisabled();
  const evidence = page.getByRole("checkbox", {
    name: "I examined this output against its acceptance criteria.",
  });
  await evidence.nth(0).check();
  await evidence.nth(1).check();
  await expect(approve).toBeEnabled();
  await expect(changes).toBeEnabled();
  await expect(reject).toBeEnabled();
  await note.fill("   ");
  await expect(approve).toBeDisabled();
  await expect(changes).toBeDisabled();
  await expect(reject).toBeDisabled();
  await expect(requirements).toContainText("Add the required review note.");
  await expect(requirements).not.toContainText(
    "Confirm you examined all 2 outputs.",
  );
  await note.fill(
    "Reviewed both simulated outputs; this note does not approve them automatically.",
  );
  await page
    .getByLabel("Proposed decision")
    .fill("A revised synthetic proposal.");
  await expect(requirements).toContainText(
    "Save the revised proposal before reviewing it.",
  );
  await expect(approve).toBeDisabled();
});
