import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const guide = (page: Page) =>
  page.getByRole("region", { name: "Learn by doing", exact: true });
async function step(page: Page, name: string) {
  await expect(guide(page)).toHaveAttribute("data-step", name);
}
async function begin(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a guided example" }).click();
  await step(page, "select");
}
async function createProject(page: Page, name: string) {
  await page
    .getByRole("checkbox", { name: "Select message m1", exact: true })
    .check();
  await step(page, "create-project");
  await page.getByRole("button", { name: "Preview excerpts" }).click();
  await page.getByLabel("Project name").fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await step(page, "create-stage");
}
async function startVisibleStage(page: Page) {
  await page.getByRole("button", { name: "Preview & start stage" }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.getByRole("button", { name: "Start simulated stage" }).click();
}
test("guided practice uses real controls and requires review plus a separate successor start", async ({
  page,
}) => {
  await begin(page);
  await createProject(page, "Guided synthetic harbor");
  await guide(page).getByRole("button", { name: "Open Runs" }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await step(page, "start-stage");
  await startVisibleStage(page);
  await step(page, "inspect");
  const inspect = page.getByRole("button", { name: "Inspect", exact: true });
  await inspect.first().click();
  await expect(
    page.getByText("Snapshot SHA-256", { exact: true }),
  ).toBeVisible();
  await step(page, "inspect");
  await inspect.nth(1).click();
  await step(page, "review");
  await guide(page).getByRole("button", { name: "Open Decisions" }).click();
  const approve = page.getByRole("button", { name: "Approve revision 1" });
  await expect(approve).toBeDisabled();
  for (const checkbox of await page
    .getByRole("checkbox", {
      name: "I examined this output against its acceptance criteria.",
    })
    .all())
    await checkbox.check();
  await page
    .getByLabel("Review note")
    .fill(
      "Examined synthetic outputs and acceptance criteria. Practice only; no verification of real conditions.",
    );
  await approve.click();
  await step(page, "create-successor");
  await guide(page).getByRole("button", { name: "Open Runs" }).click();
  await page.getByRole("button", { name: "+ Add stage", exact: true }).click();
  await page.getByLabel("Stage title").fill("Practice successor");
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await step(page, "start-successor");
  await expect(
    page.getByText("Approval recorded. Successor has not started."),
  ).toBeVisible();
  // Even repeated view navigation cannot dispatch the successor.
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  await guide(page).getByRole("button", { name: "Open Runs" }).click();
  await step(page, "start-successor");
  const before = (await (await page.request.get("/api/v1/state")).json()) as {
    tasks: { id: string }[];
  };
  await startVisibleStage(page);
  await step(page, "complete");
  const after = (await (await page.request.get("/api/v1/state")).json()) as {
    tasks: { id: string }[];
  };
  expect(after.tasks.length).toBeGreaterThan(before.tasks.length);
  expect(
    await page.evaluate(() => localStorage.getItem("claw-chat.guided-demo")),
  ).toBe("completed");
  await guide(page).getByRole("button", { name: "Finish practice" }).click();
  await expect(guide(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Learn by doing", exact: true })
    .click();
  await step(page, "select");
  await expect(
    page.getByRole("checkbox", { name: "Select message m1", exact: true }),
  ).not.toBeChecked();
});

test("skip, reload and restart persist only a preference and never create or approve work", async ({
  page,
}) => {
  await begin(page);
  const before = (await (await page.request.get("/api/v1/state")).json()) as {
    projects: unknown[];
    stages: unknown[];
    tasks: unknown[];
    events: unknown[];
  };
  const sample = page.getByRole("checkbox", {
    name: "Select message m1",
    exact: true,
  });
  await sample.check();
  await step(page, "create-project");
  await sample.uncheck();
  await step(page, "select");
  await sample.check();
  await guide(page).getByRole("button", { name: "Restart practice" }).click();
  await step(page, "select");
  await expect(sample).not.toBeChecked();
  await guide(page).getByRole("button", { name: "Skip guide" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("claw-chat.guided-demo")),
  ).toBe("dismissed");
  await page.reload();
  await expect(guide(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Explore on my own" }).click();
  await expect(guide(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Learn by doing", exact: true })
    .click();
  await step(page, "select");
  const after = (await (
    await page.request.get("/api/v1/state")
  ).json()) as typeof before;
  for (const key of ["projects", "stages", "tasks", "events"] as const)
    expect(after[key].length).toBe(before[key].length);
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.includes("guided")),
  );
  expect(keys).toEqual(["claw-chat.guided-demo"]);
});

test("switching to an existing project cannot complete a fresh guide", async ({
  page,
}) => {
  await begin(page);
  await createProject(page, "Unrelated saved practice");
  await guide(page).getByRole("button", { name: "Restart practice" }).click();
  await step(page, "select");
  // Adding to an existing project clears the actual selection, but cannot bind it.
  await page
    .getByRole("checkbox", { name: "Select message m1", exact: true })
    .check();
  await page.getByRole("button", { name: "Preview excerpts" }).click();
  await page
    .getByLabel("Destination")
    .selectOption({ label: "Unrelated saved practice" });
  await page.getByRole("button", { name: "Add exact excerpts" }).click();
  await step(page, "select");
  await page
    .getByRole("button", {
      name: "Unrelated saved practice Short-term project",
    })
    .click();
  await step(page, "select");
  await expect(guide(page)).toContainText("Select a sample excerpt");
  await guide(page).getByRole("button", { name: "Open Chat" }).click();
  await createProject(page, "Fresh scoped practice");
  await page
    .getByRole("button", {
      name: "Unrelated saved practice Short-term project",
    })
    .click();
  await expect(guide(page)).toContainText("Return to your practice");
  await guide(page).getByRole("button", { name: "Return to practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Keep the important parts." }),
  ).toBeVisible();
  await step(page, "create-stage");
});

test("mobile guide stays inline, keyboard accessible and optional", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await begin(page);
  await expect(
    page.getByRole("checkbox", { name: "Select message m1", exact: true }),
  ).toBeVisible();
  expect(
    await guide(page).evaluate((element) => getComputedStyle(element).position),
  ).toBe("static");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await guide(page).getByRole("button", { name: "Skip guide" }).focus();
  await page.keyboard.press("Enter");
  await expect(guide(page)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Learn by doing", exact: true })
    .click();
  await step(page, "select");
});

test("skipping while an explicit project save is in flight cannot resurrect the guide", async ({
  page,
}) => {
  await begin(page);
  await page
    .getByRole("checkbox", { name: "Select message m1", exact: true })
    .check();
  await page.getByRole("button", { name: "Preview excerpts" }).click();
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saved: () => void = () => {};
  const saving = new Promise<void>((resolve) => {
    saved = resolve;
  });
  await page.route("**/api/v1/projects", async (route) => {
    const response = await route.fetch();
    saved();
    await held;
    await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await saving;
  await guide(page).getByRole("button", { name: "Skip guide" }).click();
  release();
  await expect(
    page.getByRole("heading", { name: "Keep the important parts." }),
  ).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("claw-chat.guided-demo")),
  ).toBe("dismissed");
});
