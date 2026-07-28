# Presupuesto de rendimiento

La medición se ejecuta con `pnpm build` sobre la PWA de producción y Chrome local mediante Playwright.

| Métrica | Resultado medido | Presupuesto |
| --- | ---: | ---: |
| Recursos precacheados | 159 KiB | menos de 200 KiB |
| DOM listo en primera carga local | menos de 2 s | menos de 2 s |
| Elegir e iniciar una rutina local | menos de 1 s | menos de 1 s |

El presupuesto verifica recursos sin comprimir en `dist`, por lo que es conservador frente a la transferencia comprimida. Se vuelve a medir en cada `pnpm build`.
