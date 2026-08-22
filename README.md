# Train App

PWA local para registrar fuerza e hipertrofia sin red ni cuenta.

## Uso local

Instalar dependencias y construir la aplicación:

```sh
pnpm install
pnpm build
pnpm vite preview
```

Abrir la URL indicada por Vite. Tras la primera carga, el navegador puede instalar la aplicación y abrirla sin conexión.

## Respaldo

En **Respaldo**, exportar una copia JSON antes de cambiar de dispositivo o limpiar los datos del navegador. La importación valida el archivo completo antes de sustituir el estado local; un archivo inválido no cambia los datos existentes.

## Límites

Los datos pertenecen a un único atleta y a ese navegador. No hay sincronización, cuentas, servidor ni recuperación remota.
## Producción con Docker

Construye y sirve la aplicación estática en `http://localhost:8002`:

```sh
docker compose up --build
```

La imagen separa dependencias y código fuente para reutilizar la caché de Docker; con BuildKit también conserva el almacén de pnpm entre builds. El contenedor final solo contiene Nginx y los archivos estáticos generados.

## Avisos de descanso en iPhone

La PWA puede enviar avisos Push desde el mismo PC que la aloja. Genera las claves una sola vez, crea la configuración local y arranca los contenedores:

```sh
pnpm push:keys
cp .env.example .env
docker compose up --build -d
```

Copia las claves generadas en `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` de `.env`, y usa una dirección válida en `VAPID_SUBJECT`. El volumen Docker `push-data` conserva las suscripciones y los descansos pendientes. En el iPhone, instala la PWA en Home Screen y toca la campana durante un descanso para conceder permiso.
