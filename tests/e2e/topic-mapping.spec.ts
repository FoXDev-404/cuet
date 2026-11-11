import { expect, test } from "@playwright/test";
import { seedUser, sessionCookie } from "./auth-helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@cuetfreemocktest.com";

function testClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

test("an editor can map and clear a question's syllabus topic", async ({ page }) => {
  test.setTimeout(60_000);
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes and removes a QA question in local D1.",
  );

  await page.setExtraHTTPHeaders({ "cf-connecting-ip": testClientIp() });
  const admin = seedUser({ email: ADMIN_EMAIL, username: "e2e_topic_admin", admin: true });
  await page.context().addCookies([sessionCookie(admin.token)]);

  const marker = `E2E syllabus mapping ${Date.now().toString(36)}`;
  let questionId: number | null = null;

  try {
    await page.goto("/admin/questions/new");
    const subject = page.locator('[data-field="subject_id"]');
    const topic = page.locator('[data-field="topic_id"]');

    await subject.selectOption({ label: "English" });
    await expect(topic.locator("option")).toContainText(["Not mapped", "Reading Comprehension"]);
    await topic.selectOption({ label: "Reading Comprehension" });
    const englishTopicId = Number(await topic.inputValue());

    await subject.selectOption({ label: "Hindi" });
    await expect(topic).toHaveValue("");
    await subject.selectOption({ label: "English" });
    await topic.selectOption({ label: "Reading Comprehension" });

    await page.locator('[data-field="text"]').fill(`${marker}: choose the correct answer.`);
    for (const [index, text] of ["Option A", "Option B", "Option C", "Option D"].entries()) {
      await page.locator("[data-option-text]").nth(index).fill(text);
    }
    await page.locator('[data-field="explanation"]').fill("Option A is correct for this local test.");

    const createResponse = page.waitForResponse((response) =>
      response.url().endsWith("/api/admin/questions") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create question" }).click();
    const created = await createResponse;
    expect(created.status()).toBe(201);
    await page.waitForURL(/\/admin\/questions\/\d+$/);
    questionId = Number(page.url().match(/\/admin\/questions\/(\d+)$/)?.[1]);
    expect(questionId).toBeGreaterThan(0);
    await expect(page.locator('[data-field="topic_id"]')).toHaveValue(String(englishTopicId));

    await page.goto("/admin/questions");
    let row = page.locator("[data-question-row]").filter({ hasText: marker });
    await expect(row).toContainText("Reading Comprehension");

    await row.locator(`[data-select-question="${questionId}"]`).check();
    await page.locator("#bulk-action").selectOption("topic:clear");
    await page.locator("#bulk-apply").click();
    await expect(page.locator("#list-success")).toContainText("1 question(s) updated");
    await expect(row).toContainText("Unmapped", { timeout: 10_000 });

    await row.locator(`[data-select-question="${questionId}"]`).check();
    await page.locator("#bulk-action").selectOption(`topic:${englishTopicId}`);
    await page.locator("#bulk-apply").click();
    await expect(page.locator("#list-success")).toContainText("1 question(s) updated");
    await expect(row).toContainText("Reading Comprehension", { timeout: 10_000 });

    await page.goto("/admin/questions/new");
    await page.locator('[data-field="subject_id"]').selectOption({ label: "Hindi" });
    const hindiTopicId = Number(
      await page
        .locator('[data-field="topic_id"] option[data-topic-subject]:not([disabled])')
        .first()
        .getAttribute("value"),
    );
    const invalidMapping = await page.request.post("/api/admin/questions/bulk", {
      data: { action: "topic", value: String(hindiTopicId), ids: [questionId] },
    });
    expect(invalidMapping.status()).toBe(400);
    await page.goto("/admin/questions");
    row = page.locator("[data-question-row]").filter({ hasText: marker });
    await expect(row).toContainText("Reading Comprehension");
  } finally {
    if (questionId) await page.request.delete(`/api/admin/questions/${questionId}`);
  }
});
