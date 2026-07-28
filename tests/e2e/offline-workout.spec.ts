import { expect, test } from "@playwright/test";

test("recovers and finishes a workout after reloading offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Elegir rutina" }).first().click();
  await page.getByRole("button", { name: "Iniciar rutina" }).click();
  await expect(page.getByText("Entrenamiento activo")).toBeVisible();

  const inputs = page.locator("input[type=number]");
  await inputs.nth(0).fill("20");
  await inputs.nth(1).fill("8");
  await page.getByRole("button", { name: "Completar" }).first().click();
  await expect(page.getByText(/Descanso:/)).toBeVisible();

  await page.reload();
  await expect(page.getByText("Entrenamiento activo")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Entrenamiento activo")).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Finalizar" }).click();
  await expect(page.getByRole("button", { name: "Rutinas" })).toBeVisible();
});
