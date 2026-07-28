import { expect, test } from "@playwright/test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const assetSize = (directory: string): number => readdirSync(directory).reduce((total, entry) => {
  const path = join(directory, entry);
  return total + (statSync(path).isDirectory() ? assetSize(path) : statSync(path).size);
}, 0);

test("keeps the production bundle and primary interaction within budget", async ({ page }) => {
  const bundleSize = assetSize("dist");
  expect(bundleSize).toBeLessThan(200_000);

  await page.goto("/");
  const navigation = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.toJSON());
  expect(navigation?.domContentLoadedEventEnd).toBeLessThan(2_000);

  const startedAt = Date.now();
  await page.getByRole("button", { name: "Elegir rutina" }).first().click();
  await page.getByRole("button", { name: "Iniciar rutina" }).click();
  await expect(page.getByText("Entrenamiento activo")).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(1_000);
});
