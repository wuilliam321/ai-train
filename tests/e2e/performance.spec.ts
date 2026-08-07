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
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  await page.getByRole("button", { name: "Elegir rutina" }).first().click();
  await page.getByRole("button", { name: "Iniciar rutina" }).click();
  await expect(page.getByText("Entrenamiento activo")).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(1_000);
});

test("navigates without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  for (const name of ["Programa", "Rutinas"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await page.getByRole("button", { name: "Elegir rutina" }).first().click();
  await page.getByRole("button", { name: "Editar rutina" }).click();
  await expect(page.locator("#manager-title")).toHaveText("Editar rutina");
  await page.getByRole("button", { name: "Cancelar" }).click();

  await page.getByRole("button", { name: "Gestionar", exact: true }).click();
  await page.getByRole("button", { name: "Editar" }).first().click();
  await expect(page.getByRole("heading", { name: "Editar ejercicio" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  for (const name of ["Historial", "Progreso", "Respaldo"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }

  expect(errors).toEqual([]);
});

test("keeps the mobile training flow visible and easy to tap", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const navigationButtons = page.locator(".app-navigation button");
  const count = await navigationButtons.count();
  expect(count).toBeGreaterThanOrEqual(6);

  for (let index = 0; index < count; index += 1) {
    const box = await navigationButtons.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (box === null) throw new Error("El control de navegación no tiene tamaño");
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }

  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  await page.getByRole("button", { name: "Elegir rutina" }).first().click();
  await expect(page.getByRole("button", { name: "Iniciar rutina" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mobile-routines.png"), fullPage: true });
});
