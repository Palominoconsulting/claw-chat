import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { WorkspaceState } from "../../shared/types.js";

const guide = (page: Page) =>
  page.getByRole("region", {
    name: "Learn by doing",
    exact: true,
    includeHidden: true,
  });
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
  await expect(
    page.getByRole("heading", { name: "Review the launch packet" }),
  ).toBeInViewport();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.getByRole("button", { name: "Start simulated stage" }).click();
  await expect(
    page.getByRole("region", { name: "Launch preview" }),
  ).toHaveCount(0);
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

async function readyToInspect(page: Page, name: string) {
  await begin(page);
  await createProject(page, name);
  await guide(page).getByRole("button", { name: "Open Runs" }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await startVisibleStage(page);
  await step(page, "inspect");
}
const inspector = (page: Page) => page.locator("aside.inspector");
const inspectButtons = (page: Page) =>
  page.getByRole("button", { name: "Inspect", exact: true });
async function snapshotLoaded(page: Page) {
  await expect(inspector(page).locator("dd").last()).toHaveText(
    /^[a-f0-9]{64}$/,
  );
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`mobile result navigation completes real review and separate start ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await readyToInspect(page, `Inspect pointer ${viewport.width}`);
    await inspectButtons(page).first().click();
    await snapshotLoaded(page);
    await expect(inspector(page)).toContainText("Result 1 of 2");
    await expect(guide(page)).toContainText(
      "Still to inspect: Compare the two walking routes",
    );
    await step(page, "inspect");
    await expect(
      inspector(page).getByRole("button", { name: "Review checkpoint" }),
    ).toHaveCount(0);
    // These are normal pointer clicks, not forced events through an overlay.
    await inspector(page).getByRole("button", { name: "Next result" }).click();
    await snapshotLoaded(page);
    await expect(inspector(page)).toContainText("Result 2 of 2");
    await expect(
      inspector(page).getByRole("heading", {
        name: "Compare the two walking routes",
      }),
    ).toBeVisible();
    await step(page, "review");
    await page.screenshot({
      path: `test-results/inspect-mobile-${viewport.width}.png`,
    });
    await inspector(page)
      .getByRole("button", { name: "Review checkpoint" })
      .click();
    await expect(inspector(page)).toHaveCount(0);
    await expect(page.locator(".workspace-body h2")).toBeFocused();
    const approve = page.getByRole("button", { name: "Approve revision 1" });
    await expect(approve).toBeDisabled();
    for (const checkbox of await page
      .getByRole("checkbox", {
        name: "I examined this output against its acceptance criteria.",
      })
      .all()) {
      await expect(checkbox).not.toBeChecked();
      await checkbox.check();
    }
    await page
      .getByLabel("Review note")
      .fill(
        "Examined synthetic outputs and acceptance criteria. Practice only.",
      );
    await approve.click();
    await step(page, "create-successor");
    await guide(page).getByRole("button", { name: "Open Runs" }).click();
    const beforeOpening = await (
      await page.request.get("/api/v1/state")
    ).json();
    const addStage = page.getByRole("button", {
      name: "+ Add stage",
      exact: true,
    });
    await addStage.click();
    await expect(page.getByLabel("Stage title")).toBeFocused();
    await expect(page.getByLabel("Stage title")).toBeInViewport();
    await page.getByLabel("Stage title").fill("Mobile practice successor");
    // A second Add reveals the same draft instead of silently closing it.
    await addStage.click();
    await expect(page.getByLabel("Stage title")).toBeFocused();
    await expect(page.getByLabel("Stage title")).toBeInViewport();
    await expect(page.getByLabel("Stage title")).toHaveValue(
      "Mobile practice successor",
    );
    await page.getByRole("button", { name: "Cancel stage" }).click();
    await expect(page.getByLabel("Stage title")).toHaveCount(0);
    await expect(addStage).toBeFocused();
    await addStage.click();
    await expect(page.getByLabel("Stage title")).toBeFocused();
    const afterOpening = await (await page.request.get("/api/v1/state")).json();
    for (const key of ["tasks", "stages", "events"] as const)
      expect(afterOpening[key]).toEqual(beforeOpening[key]);
    await page
      .getByRole("button", { name: "Create stage", exact: true })
      .click();
    await step(page, "start-successor");
    await expect(
      page.getByRole("button", { name: "Preview & start stage" }),
    ).toBeInViewport();
    await expect(
      page.getByText("Approval recorded. Successor has not started."),
    ).toBeVisible();
    const before = await (await page.request.get("/api/v1/state")).json();
    await startVisibleStage(page);
    await step(page, "complete");
    const after = await (await page.request.get("/api/v1/state")).json();
    expect(after.tasks.length).toBeGreaterThan(before.tasks.length);
    // The shared fixture admits only one active stage. Leave no running successor
    // for the next test to collide with; wait for actual state, never a fixed sleep.
    await expect
      .poll(async () => {
        const state = (await (
          await page.request.get("/api/v1/state")
        ).json()) as WorkspaceState;
        return state.tasks.filter((task) => task.status === "running").length;
      })
      .toBe(0);
  });
}

test("small inspector scroll, Back, close, Escape and keyboard navigation reveal usable tasks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await readyToInspect(page, "Small dismissible results");
  const first = inspectButtons(page).first();
  await first.click();
  await snapshotLoaded(page);
  const pane = inspector(page);
  await expect(pane).toHaveAttribute("role", "dialog");
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await pane.getByText("Exact launch snapshot", { exact: true }).click();
  await expect(pane.locator("blockquote").first()).toBeVisible();
  await pane.locator(".fine-print").scrollIntoViewIfNeeded();
  await expect(pane.locator(".fine-print")).toBeInViewport();
  for (const button of await pane.getByRole("button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  const back = pane.getByRole("button", { name: "Back to tasks" });
  await expect(back).toBeInViewport();
  await back.click();
  await expect(pane).toHaveCount(0);
  await expect(first).toBeFocused();
  // Prove the previously occluded second task is pointer usable after dismissal.
  await inspectButtons(page).nth(1).click();
  await snapshotLoaded(page);
  await pane.getByRole("button", { name: "Close inspector" }).click();
  await expect(inspectButtons(page).nth(1)).toBeFocused();
  await first.click();
  await snapshotLoaded(page);
  await page.keyboard.press("Escape");
  await expect(pane).toHaveCount(0);
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await snapshotLoaded(page);
  await expect(
    pane.getByRole("button", { name: "Close inspector" }),
  ).toBeFocused();
  // Reverse tab wraps inside the small-screen sheet, never into hidden review controls.
  await page.keyboard.press("Shift+Tab");
  await expect(
    pane.getByText("Exact launch snapshot", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    pane.getByRole("button", { name: "Close inspector" }),
  ).toBeFocused();
  await back.focus();
  await page.keyboard.press("Enter");
  await expect(pane).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("snapshot failure is visible above mobile content, retries and never advances observation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await readyToInspect(page, "Retry synthetic snapshot");
  let failed = false;
  await page.route("**/api/v1/stages/*/snapshot", async (route) => {
    if (!failed) {
      failed = true;
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic snapshot temporarily unavailable" },
      });
    } else await route.continue();
  });
  await inspectButtons(page).first().click();
  await expect(inspector(page).getByRole("alert")).toContainText(
    "Synthetic snapshot temporarily unavailable",
  );
  await expect(inspector(page)).toContainText(
    "2 of 2 snapshots still to inspect",
  );
  await expect(
    inspector(page).getByRole("button", { name: "Back to tasks" }),
  ).toBeInViewport();
  await step(page, "inspect");
  await inspector(page).getByRole("button", { name: "Retry snapshot" }).click();
  await snapshotLoaded(page);
  await expect(inspector(page).getByRole("alert")).toHaveCount(0);
  await expect(inspector(page)).toContainText(
    "1 of 2 snapshots still to inspect",
  );
  await inspector(page).getByRole("button", { name: "Next result" }).click();
  await step(page, "review");
});

test("late inspection success cannot replace the current task or count a skipped result", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await readyToInspect(page, "Racing synthetic snapshots");
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  let first = true;
  await page.route("**/api/v1/stages/*/snapshot", async (route) => {
    if (!first) {
      await route.continue();
      return;
    }
    first = false;
    const response = await route.fetch();
    started();
    await held;
    await route.fulfill({ response });
  });
  await inspectButtons(page).first().click();
  await pending;
  await inspector(page).getByRole("button", { name: "Next result" }).click();
  await snapshotLoaded(page);
  const received = page.waitForResponse((response) =>
    response.url().endsWith("/snapshot"),
  );
  release();
  await received;
  await expect(inspector(page)).toContainText("Result 2 of 2");
  await expect(inspector(page)).toContainText(
    "1 of 2 snapshots still to inspect",
  );
  await expect(guide(page)).toContainText(
    "Still to inspect: Collect tidal observations",
  );
  await step(page, "inspect");
  await inspector(page).getByRole("button", { name: "Next result" }).click();
  await snapshotLoaded(page);
  await step(page, "review");
});

test("closing an in-flight snapshot ignores its late response and reopening can retry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await readyToInspect(page, "Closed synthetic snapshot");
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  let first = true;
  await page.route("**/api/v1/stages/*/snapshot", async (route) => {
    if (!first) {
      await route.continue();
      return;
    }
    first = false;
    const response = await route.fetch();
    started();
    await held;
    await route.fulfill({ response });
  });
  await inspectButtons(page).first().click();
  await pending;
  await inspector(page).getByRole("button", { name: "Back to tasks" }).click();
  const received = page.waitForResponse((response) =>
    response.url().endsWith("/snapshot"),
  );
  release();
  await received;
  await expect(inspector(page)).toHaveCount(0);
  await expect(guide(page)).toContainText(
    "Still to inspect: Collect tidal observations",
  );
  await expect(guide(page)).toContainText("Compare the two walking routes");
  await inspectButtons(page).nth(1).click();
  await snapshotLoaded(page);
  await expect(inspector(page)).toContainText(
    "1 of 2 snapshots still to inspect",
  );
});

test("ordinary desktop navigation stays in the inspected stage and does not change runtime state", async ({
  page,
}) => {
  await readyToInspect(page, "Ordinary synthetic results");
  await guide(page).getByRole("button", { name: "Skip guide" }).click();
  const before = await (await page.request.get("/api/v1/state")).json();
  await inspectButtons(page).first().click();
  await snapshotLoaded(page);
  await expect(inspector(page)).toHaveAttribute("role", "complementary");
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
  await inspector(page).getByRole("button", { name: "Next result" }).click();
  await snapshotLoaded(page);
  await expect(inspector(page)).toContainText("Result 2 of 2");
  await expect(
    inspector(page).getByRole("button", { name: "Review checkpoint" }),
  ).toBeVisible();
  await inspector(page)
    .getByRole("button", { name: "Review checkpoint" })
    .click();
  await expect(
    page.getByRole("button", { name: "Approve revision 1" }),
  ).toBeDisabled();
  const after = await (await page.request.get("/api/v1/state")).json();
  for (const key of ["tasks", "stages", "events", "projects"] as const)
    expect(after[key]).toEqual(before[key]);
});

test("a mismatched snapshot never counts as inspection", async ({ page }) => {
  await readyToInspect(page, "Mismatched synthetic snapshot");
  await page.route("**/api/v1/stages/*/snapshot", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    await route.fulfill({
      json: { ...snapshot, id: "unrelated-synthetic-snapshot" },
    });
  });
  await inspectButtons(page).first().click();
  await expect(inspector(page).getByRole("alert")).toContainText(
    "does not match this task",
  );
  await expect(inspector(page)).toContainText(
    "2 of 2 snapshots still to inspect",
  );
  await step(page, "inspect");
  await inspector(page).getByRole("button", { name: "Back to tasks" }).click();
  await expect(inspector(page)).toHaveCount(0);
});

test("inspection loads while an unrelated explicit save is awaiting refresh", async ({
  page,
}) => {
  await readyToInspect(page, "Independent snapshot read");
  await page.getByRole("button", { name: "Context", exact: true }).click();
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/state", async (route) => {
    const response = await route.fetch();
    started();
    await held;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Promote to long-term" }).click();
  await pending;
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await inspectButtons(page).first().click();
  await snapshotLoaded(page);
  await expect(inspector(page)).toContainText(
    "1 of 2 snapshots still to inspect",
  );
  release();
  await expect(page.locator(".statusbar")).not.toContainText("Saving…");
});
