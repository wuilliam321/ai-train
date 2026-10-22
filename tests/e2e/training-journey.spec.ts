import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const importProgram = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByRole("button", { name: "Respaldo", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles("docs/programa-entrenamiento.json");
  await expect(page.getByRole("heading", { name: "Programa", exact: true })).toBeVisible();
};

test("chooses and starts a lower routine inside its own card on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  const cards = page.locator('[aria-labelledby="routines-title"] > ul > li');
  const card = cards.last();
  const name = await card.locator("strong").first().innerText();
  await card.getByRole("button", { name: "Elegir rutina" }).click();
  const start = card.getByRole("button", { name: "Iniciar rutina" });
  await expect(start).toBeInViewport();
  await expect(start).toBeFocused();
  await expect(card.getByRole("combobox", { name: "Variante" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("routine-inline-mobile.png"), fullPage: false });
  await start.click();
  await expect(page.locator("#active-title")).toHaveText(name);
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  await cards.nth(2).getByRole("button", { name: "Elegir rutina" }).click();
  await expect(cards.nth(2).getByRole("button", { name: "Iniciar rutina" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Iniciar rutina" })).toHaveCount(1);
});

test("keeps previous, current and following sessions correct through a week, offline reload and discard", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importProgram(page);
  const previous = page.locator(".journey-previous");
  const current = page.locator(".journey-current");
  const next = page.locator(".journey-next");
  const names = ["Pecho, espalda y brazos", "Piernas · Sentadilla y rumano", "Hombros, pecho y brazos", "Piernas · Glúteos y cuádriceps"];
  await expect(previous).toContainText("Aún no registraste");
  await expect(current).toContainText(names[0]!);
  await expect(next).toContainText(names[1]!);
  await expect(page.locator(".program-sequence > li")).toHaveCount(4);
  await expect(page.getByText(/Simple ·/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("program-mobile.png"), fullPage: true });

  const secondSession = page.locator(".program-sequence > li").nth(1);
  await secondSession.getByRole("button", { name: "Ver ejercicios" }).click();
  await expect(secondSession.getByRole("region", { name: "Contenido de la sesión" })).toContainText("Romanian Deadlift");
  await expect(current).toContainText(names[0]!);

  for (let day = 0; day < 4; day += 1) {
    await current.getByRole("button", { name: "Iniciar próxima" }).click();
    await expect(page.locator("#active-title")).toHaveText(names[day]!);
    await expect(current).toContainText("En curso");
    await expect(next).toContainText(names[(day + 1) % 4]!);
    if (day === 0) {
      await expect(current).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath("workout-context-mobile.png"), fullPage: false });
    }
    await page.locator('input[type="number"]').nth(0).fill("20");
    await page.locator('input[type="number"]').nth(1).fill("8");
    await page.getByRole("button", { name: "Completar", exact: true }).first().click();
    await expect(page.getByText("Completada: 20 kg × 8")).toBeVisible();
    if (day === 0) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator("#active-title")).toHaveText(names[0]!);
      await expect(next).toContainText(names[1]!);
    }
    await page.getByRole("button", { name: "Finalizar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Programa", exact: true })).toBeVisible();
    await expect(previous).toContainText(names[day]!);
    await expect(previous).toContainText("Series completadas: 1");
    await expect(current).toContainText(names[(day + 1) % 4]!);
    await expect(current.getByRole("button", { name: "Iniciar próxima" })).toBeInViewport();
  }

  await expect(current).toContainText("Sesión 1 · Semana 2");
  await expect(next).toContainText("Sesión 2 · Semana 2");
  await expect(page.getByRole("combobox", { name: "Semana", exact: true })).toHaveValue("2");
  await page.reload();
  await expect(previous).toContainText(names[3]!);
  await expect(current).toContainText("Sesión 1 · Semana 2");
  await current.getByRole("button", { name: "Iniciar próxima" }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(current.getByRole("button", { name: "Continuar sesión" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar próxima" })).toHaveCount(0);
  await current.getByRole("button", { name: "Continuar sesión" }).click();
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(current).toContainText("Sesión 1 · Semana 2");
  await current.getByRole("button", { name: "Omitir esta sesión" }).click();
  await expect(current).toContainText("Sesión 2 · Semana 2");
  await expect(next).toContainText("Sesión 3 · Semana 2");
  await context.setOffline(false);
});


test("keeps a free workout separate from the pending program sequence", async ({ page }) => {
  await importProgram(page);
  await page.getByRole("button", { name: "Rutinas", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar entrenamiento vacío" }).click();
  await expect(page.locator(".journey-current")).toContainText("Entrenamiento libre");
  await expect(page.locator(".journey-next")).toContainText("Sesión 1 · Semana 1");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.locator(".journey-current").getByRole("button", { name: "Continuar sesión" }).click();
  await expect(page.locator("#active-title")).toBeVisible();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(page.locator(".journey-previous")).toContainText("Entrenamiento libre");
  await expect(page.locator(".journey-current")).toContainText("Sesión 1 · Semana 1");
});

test("finishes the last scheduled session and repeats a cycle without losing the previous workout", async ({ page }) => {
  await importProgram(page);
  await page.evaluate(() => {
    const document = JSON.parse(localStorage.getItem("train-app")!);
    const sessions = document.programCycles[0].sessions;
    for (const session of sessions.slice(0, -1)) session.status = "skipped";
    localStorage.setItem("train-app", JSON.stringify(document));
  });
  await page.reload();
  await expect(page.locator(".journey-current")).toContainText("Sesión 4 · Semana 8");
  await expect(page.locator(".journey-next")).toContainText("Esta sesión cierra el ciclo");
  await page.getByRole("button", { name: "Iniciar próxima" }).click();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await expect(page.locator(".journey-current")).toContainText("Ciclo completado");
  await expect(page.getByRole("button", { name: "Iniciar próxima" })).toHaveCount(0);
  await page.getByRole("button", { name: "Repetir ciclo" }).click();
  await expect(page.locator(".journey-current")).toContainText("Sesión 1 · Semana 1");
  await expect(page.locator(".journey-previous")).toContainText("Piernas · Glúteos y cuádriceps");
});
