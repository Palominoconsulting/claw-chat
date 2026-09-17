import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type AudioLog = { event: string; from?: number; gesture?: boolean }[];
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const log: AudioLog = [];
    Object.assign(window, { soundLog: log });
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor() {
        super();
        log.push({
          event: "construct",
          gesture: navigator.userActivation.isActive,
        });
      }
      override resume() {
        log.push({
          event: "resume",
          gesture: navigator.userActivation.isActive,
        });
        return super.resume();
      }
      override createOscillator() {
        const oscillator = super.createOscillator();
        let from = 0;
        const set = oscillator.frequency.setValueAtTime.bind(
          oscillator.frequency,
        );
        oscillator.frequency.setValueAtTime = (value, time) => {
          from = value;
          return set(value, time);
        };
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (time) => {
          log.push({ event: "start", from });
          start(time);
        };
        const stop = oscillator.stop.bind(oscillator);
        oscillator.stop = (time) => {
          log.push({ event: "stop" });
          stop(time);
        };
        oscillator.addEventListener("ended", () =>
          log.push({ event: "ended" }),
        );
        return oscillator;
      }
    };
  });
}
const log = (page: Page) =>
  page.evaluate(() => (window as unknown as { soundLog: AudioLog }).soundLog);
const frequencies = async (page: Page) =>
  (await log(page))
    .filter((item) => item.event === "start")
    .map((item) => item.from);
async function controls(page: Page) {
  await page.locator(".sound-controls > summary").click();
  await expect(
    page.getByRole("group", { name: "Lobster sounds", exact: true }),
  ).toBeVisible();
}
async function activate(page: Page) {
  await controls(page);
  await page.getByRole("checkbox", { name: "Enable Lobster sounds" }).check();
  await page.getByRole("button", { name: "Test sound", exact: true }).click();
  await expect.poll(() => frequencies(page)).toEqual([240, 300]);
  // Exercise the real cooldown without replacing the audio clock.
  await page.waitForTimeout(1250);
}
async function previewProject(page: Page) {
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("checkbox", { name: "Select message m1", exact: true })
    .check();
  await page.getByRole("button", { name: "Preview excerpts" }).click();
  await page.getByLabel("Project name").fill("Sound policy synthetic project");
}

test("mobile controls are keyboard reachable on welcome/setup/workspace; opt-in and volume persist but activation does not", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await instrument(page);
  await page.goto("/");
  await page.locator(".sound-controls > summary").focus();
  await page.keyboard.press("Enter");
  const enabled = page.getByRole("checkbox", { name: "Enable Lobster sounds" });
  await expect(enabled).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Test sound", exact: true }),
  ).toBeDisabled();
  expect(await log(page)).toEqual([]);
  await enabled.check();
  const volume = page.getByRole("slider", { name: "Lobster sound volume" });
  await volume.fill("20");
  expect(await log(page)).toEqual([]);
  await page.getByRole("button", { name: "Test sound", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => frequencies(page)).toEqual([240, 300]);
  expect(
    (await log(page))
      .filter((item) => ["construct", "resume"].includes(item.event))
      .every((item) => item.gesture),
  ).toBe(true);
  await page.reload();
  await controls(page);
  await expect(enabled).toBeChecked();
  await expect(volume).toHaveValue("20");
  await expect(
    page.getByText("Use Test sound to activate for this visit"),
  ).toBeVisible();
  expect(await log(page)).toEqual([]);
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await expect(enabled).toBeVisible();
  expect(await log(page)).toEqual([]);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: /Connection/ }).click();
  await expect(
    page.getByRole("heading", { name: "A clear boundary." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(enabled).toBeVisible();
  expect(await log(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".artifacts/lobster-sounds-mobile.png" });
});

test("only confirmed saves, demo launch and its new returned stage cue; polling/navigation/approval stay silent", async ({
  page,
}) => {
  await instrument(page);
  const external: string[] = [];
  const failures: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4318")
      external.push(request.url());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy"))
      failures.push(message.text());
  });
  await page.goto("/");
  await activate(page);
  await previewProject(page);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect.poll(() => frequencies(page)).toEqual([240, 300, 740, 940]);
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await page.getByRole("button", { name: "Preview & start stage" }).click();
  await expect(page.getByText("Quiet during review or errors")).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.waitForTimeout(1250);
  await page
    .getByRole("button", { name: "Start simulated stage", exact: true })
    .click();
  await expect
    .poll(() => frequencies(page))
    .toEqual([240, 300, 740, 940, 420, 540, 460, 640]);
  await expect
    .poll(() => frequencies(page))
    .toEqual([240, 300, 740, 940, 420, 540, 460, 640, 240, 300]);
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  for (const checkbox of await page
    .getByRole("checkbox", {
      name: "I examined this output against its acceptance criteria.",
    })
    .all())
    await checkbox.check();
  await page
    .getByLabel("Review note")
    .fill("Synthetic sound regression review only. No real findings verified.");
  await page.getByRole("button", { name: "Approve revision 1" }).click();
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page.waitForTimeout(1500);
  expect((await frequencies(page)).length).toBe(10);
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
});

test("failed save is silent; mute cancels scheduled voices immediately and remains off after reload", async ({
  page,
}) => {
  await instrument(page);
  await page.goto("/");
  await activate(page);
  await previewProject(page);
  await page.route("**/api/v1/projects", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic save refused" }),
    });
  });
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Synthetic save refused");
  expect(await frequencies(page)).toEqual([240, 300]);
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.getByRole("button", { name: "Test sound", exact: true }).click();
  await expect.poll(() => frequencies(page)).toEqual([240, 300, 240, 300]);
  await page.getByRole("checkbox", { name: "Enable Lobster sounds" }).uncheck();
  expect(
    (await log(page)).filter((item) => item.event === "stop").length,
  ).toBeGreaterThan(4);
  await page.reload();
  await controls(page);
  await expect(
    page.getByRole("checkbox", { name: "Enable Lobster sounds" }),
  ).not.toBeChecked();
  expect(await log(page)).toEqual([]);
});

test("hidden page cancels audio and returning never replays; a fresh explicit test is required", async ({
  page,
}) => {
  await instrument(page);
  await page.goto("/");
  await activate(page);
  await page.getByRole("button", { name: "Test sound", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = await frequencies(page);
  expect(
    (await log(page)).filter((item) => item.event === "stop").length,
  ).toBeGreaterThan(4);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByText("Use Test sound to activate for this visit"),
  ).toBeVisible();
  await page.waitForTimeout(1250);
  expect(await frequencies(page)).toEqual(before);
});

test("missing Web Audio does not break the app", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: undefined });
  });
  await page.goto("/");
  await controls(page);
  await page.getByRole("checkbox", { name: "Enable Lobster sounds" }).check();
  await page.getByRole("button", { name: "Test sound", exact: true }).click();
  await expect(
    page.getByText("Audio unavailable. You can try again."),
  ).toBeVisible();
  await previewProject(page);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep the important parts." }),
  ).toBeVisible();
});

for (const mode of ["mute/reactivation", "initially off"] as const)
  test(`a save acknowledged after ${mode} does not catch up an old cue`, async ({
    page,
  }) => {
    await instrument(page);
    await page.goto("/");
    if (mode === "mute/reactivation") await activate(page);
    else await controls(page);
    await previewProject(page);
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requested = false;
    await page.route("**/api/v1/projects", async (route) => {
      const response = await route.fetch();
      requested = true;
      await held;
      await route.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await expect.poll(() => requested).toBe(true);
    const enabled = page.getByRole("checkbox", {
      name: "Enable Lobster sounds",
    });
    if (mode === "mute/reactivation") await enabled.uncheck();
    await enabled.check();
    await page.getByRole("button", { name: "Test sound", exact: true }).click();
    const expected =
      mode === "mute/reactivation" ? [240, 300, 240, 300] : [240, 300];
    await expect.poll(() => frequencies(page)).toEqual(expected);
    await page.waitForTimeout(1250);
    release();
    await expect(
      page.getByRole("heading", { name: "Keep the important parts." }),
    ).toBeVisible();
    expect(await frequencies(page)).toEqual(expected);
  });

test("completion first observed on Decisions is discarded, never replayed when leaving review", async ({
  page,
}) => {
  await instrument(page);
  await page.goto("/");
  await activate(page);
  await previewProject(page);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect.poll(() => frequencies(page)).toEqual([240, 300, 740, 940]);
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await page.getByRole("button", { name: "Preview & start stage" }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.waitForTimeout(1250);
  await page
    .getByRole("button", { name: "Start simulated stage", exact: true })
    .click();
  await expect
    .poll(() => frequencies(page))
    .toEqual([240, 300, 740, 940, 420, 540, 460, 640]);
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  await expect(page.getByText("Quiet during review or errors")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve revision 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.waitForTimeout(1500);
  expect((await frequencies(page)).length).toBe(8);
});

test("a slow launch confirmation consumes already-returned results instead of replaying them later", async ({
  page,
}) => {
  await instrument(page);
  await page.goto("/");
  await activate(page);
  await previewProject(page);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect.poll(() => frequencies(page)).toEqual([240, 300, 740, 940]);
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await page.getByRole("button", { name: "Preview & start stage" }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the tasks and this exact packet.",
    })
    .check();
  await page.waitForTimeout(1250);
  await page.route("**/api/v1/state", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Start simulated stage", exact: true })
    .click();
  await expect
    .poll(() => frequencies(page))
    .toEqual([240, 300, 740, 940, 420, 540, 460, 640]);
  await page.unroute("**/api/v1/state");
  await page.waitForTimeout(1250);
  // Inspect causes a fresh /state read after the stage already returned.
  await page
    .getByRole("button", { name: "Inspect", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Snapshot SHA-256", { exact: true }),
  ).toBeVisible();
  expect((await frequencies(page)).length).toBe(8);
});
