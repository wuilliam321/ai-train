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
