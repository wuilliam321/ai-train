import { expect, test } from "@playwright/test";

test("recovers and finishes a workout after reloading offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
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

test("closes and continues an active program session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Programa", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar programa" }).first().click();
  await page.getByRole("button", { name: "Iniciar próxima" }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();

  await page.getByRole("button", { name: "Programa", exact: true }).click();
  await page.getByRole("button", { name: "Continuar sesión" }).first().click();
  await expect(page.getByText("Entrenamiento activo")).toBeVisible();
  await page.getByRole("button", { name: "Descartar", exact: true }).click();

  await page.getByRole("button", { name: "Programa", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continuar sesión" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Iniciar próxima" })).toBeVisible();
});


test("explains an unavailable active program workout without opening a blank view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Iniciar programa" }).first().click();
  await page.getByRole("button", { name: "Iniciar próxima" }).click();
  await page.evaluate(() => {
    const document = JSON.parse(localStorage.getItem("train-app")!);
    document.workouts = [];
    localStorage.setItem("train-app", JSON.stringify(document));
  });
  await page.reload();
  await page.getByRole("button", { name: "Continuar sesión" }).first().click();
  await expect(page.getByRole("alert")).toContainText("No se encontró el entrenamiento activo");
  await expect(page.getByRole("heading", { name: "Programa", exact: true })).toBeVisible();
});
