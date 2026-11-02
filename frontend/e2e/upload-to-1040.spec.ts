import { expect, test } from "@playwright/test";

import { signIn, syntheticPdf } from "./helpers";

test("TC-E2E-001: upload a W-2, review it, and download the 1040 PDF", async ({ page }) => {
  await signIn(page);

  await page.getByRole("link", { name: "Sample, Jane" }).click();
  await page.getByRole("link", { name: /2026 Form 1040/ }).click();
  await page.getByRole("link", { name: "Open documents" }).click();

  const filename = `e2e_w2_${Date.now()}.pdf`;
  await page.getByLabel("Choose files to upload").setInputFiles({ name: filename, mimeType: "application/pdf", buffer: syntheticPdf(filename) });

  // Browser → pre-signed PUT to S3 → API → worker; status updates without reloading.
  const row = page.getByRole("row", { name: new RegExp(filename) });
  await expect(row.getByText(/Needs review|Ready to review/)).toBeVisible({ timeout: 30_000 });
  await row.getByRole("link", { name: filename, exact: true }).click();

  // Resolve every flagged field, then mark the document reviewed.
  await expect(page.getByLabel("Box 1 Wages, tips, other comp.")).toBeVisible();
  const confirm = page.getByRole("button", { name: "Value is correct" });
  while ((await confirm.count()) > 0) {
    const saved = page.waitForResponse((r) => r.url().includes("/fields/") && r.request().method() === "PATCH");
    await confirm.first().click();
    expect((await saved).ok()).toBe(true);
  }
  await page.getByRole("button", { name: /Mark reviewed/ }).click();
  await expect(page.getByText("Reviewed. This document feeds the return.")).toBeVisible();

  // Form 1040: wages come from the reviewed W-2; enter line 16; download.
  await page.getByRole("link", { name: /2026 Return/ }).click();
  await page.getByRole("link", { name: "Open Form 1040" }).click();
  const line1a = page.getByRole("row", { name: /Total amount from Form\(s\) W-2, box 1/ });
  await expect(line1a.getByText("From W-2s")).toBeVisible();
  await expect(line1a).toContainText(/[1-9][\d,]*\.\d{2}/); // wages from the reviewed W-2, not zero

  await page.getByRole("button", { name: "Edit line 16" }).click();
  await page.getByLabel(/Tax \(from tax table/).fill("4,500");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: /^16 / }).getByText("Edited")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^1040-2026-.*\.pdf$/);
});

test("TC-ACC-001: a signed-out visitor can't reach client pages", async ({ page }) => {
  await page.goto("/clients");
  await expect(page).toHaveURL(/\/login\?next=%2Fclients/);
});
