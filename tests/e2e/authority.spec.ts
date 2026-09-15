import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import type { Project, Stage, WorkspaceState } from "../../shared/types.js";
async function post(request: APIRequestContext, path: string, body: unknown) {
  const bootstrap = (await (await request.get("/api/v1/bootstrap")).json()) as {
    csrf: string;
  };
  const base = new URL((await request.get("/api/v1/state")).url()).origin;
  return request.post(`/api/v1${path}`, {
    data: body,
    headers: { origin: base, "x-csrf-token": bootstrap.csrf },
  });
}
test("another tab's history page cannot replace exact excerpts in the capture preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  await page
    .getByRole("checkbox", { name: "Select message m1", exact: true })
    .check();
  await page.getByRole("button", { name: "Preview excerpts" }).click();
  const displayed = await page
    .locator(".excerpt-preview blockquote p")
    .textContent();
  const secondTab = await page.context().newPage();
  await secondTab.goto("/");
  // Same browser cookie, another bounded page omits m1. It must not overwrite the first candidate.
  const otherPage = await secondTab.request.get(
    "/api/v1/history?key=demo%3Aharbor&offset=2&limit=1",
  );
  expect(otherPage.status()).toBe(200);
  await page.getByLabel("Project name").fill("Exact competing tab");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep the important parts." }),
  ).toBeVisible();
  const state = (await (
    await page.request.get("/api/v1/state")
  ).json()) as WorkspaceState;
  const project = state.projects.find((p) => p.name === "Exact competing tab")!;
  expect(
    state.context.filter((c) => c.projectId === project.id).map((c) => c.text),
  ).toEqual([displayed]);
  await secondTab.close();
});
test("launch preview remains immutable across a refresh and stale Start performs no dispatch", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore the demo/ }).click();
  const history = (await (
    await page.request.get("/api/v1/history?key=demo%3Aharbor")
  ).json()) as { pageToken: string };
  const project = (await (
    await post(page.request, "/projects", {
      name: "Stale launch fixture",
      lifetime: "short_term",
      key: "demo:harbor",
      pageToken: history.pageToken,
      messageIds: ["m1"],
    })
  ).json()) as Project;
  const stage = (await (
    await post(page.request, `/projects/${project.id}/stages`, {
      title: "Synthetic compare",
      briefs: [{ objective: "Compare", acceptance: "Read evidence" }],
    })
  ).json()) as Stage;
  await page.reload();
  await page.getByRole("button", { name: /^Stale launch fixture/ }).click();
  await page.getByRole("button", { name: "Runs", exact: true }).click();
  await page.getByRole("button", { name: "Preview & start stage" }).click();
  const preview = page.getByRole("region", { name: "Launch preview" });
  await expect(preview).toBeVisible();
  const original = await preview.locator("blockquote p").textContent();
  const state = (await (
    await page.request.get("/api/v1/state")
  ).json()) as WorkspaceState;
  const item = state.context.find((c) => c.projectId === project.id)!;
  expect(
    (
      await post(page.request, `/projects/${project.id}/context/${item.id}`, {
        kind: "note",
        text: "UNSEEN REPLACEMENT FROM TAB B",
      })
    ).status(),
  ).toBe(200);
  // An unrelated mutation refreshes App state while the existing preview stays open.
  await page.getByRole("button", { name: "+ Add stage", exact: true }).click();
  await page.getByRole("button", { name: "Create stage", exact: true }).click();
  await expect(preview.locator("blockquote p")).toHaveText(original!);
  await preview.getByRole("checkbox").check();
  const rejected = page.waitForResponse((r) =>
    r.url().endsWith(`/stages/${stage.id}/start`),
  );
  await page.getByRole("button", { name: "Start simulated stage" }).click();
  expect((await rejected).status()).toBe(409);
  const after = (await (
    await page.request.get("/api/v1/state")
  ).json()) as WorkspaceState;
  expect(after.tasks.filter((t) => t.stageId === stage.id)).toHaveLength(0);
  expect(after.stages.find((s) => s.id === stage.id)?.status).toBe("draft");
});
