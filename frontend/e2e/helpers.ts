import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export const OWNER = { email: "owner@payntax.test", password: "local-demo-password" };

/** Current MFA code for a seeded user, from the dev-only `totp` command. */
export function totp(email = OWNER.email): string {
  return execSync(`docker compose exec -T backend python manage.py totp ${email}`, { cwd: "..", encoding: "utf8" }).trim();
}

export async function signIn(page: Page, user = OWNER) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/mfa/);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel("6-digit code").fill(totp(user.email));
    await page.getByRole("button", { name: "Verify" }).click();
    const outcome = await Promise.race([
      page.waitForURL(/\/clients/).then(() => "ok", () => "timeout"),
      page.getByText("That code didn't work").waitFor().then(() => "rejected", () => "timeout"),
    ]);
    if (outcome === "ok") return;
    // A code can't be reused in the same 30 s window (replay protection). Wait for the next one.
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
  }
  await expect(page).toHaveURL(/\/clients/);
}

/** A tiny valid-looking PDF. The synthetic extractor classifies by file name. */
export const syntheticPdf = (label: string) => Buffer.from(`%PDF-1.4\n% SYNTHETIC TEST DOCUMENT ${label}\n%%EOF`);
