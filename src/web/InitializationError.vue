<script setup lang="ts">
import type { DataErrorInitializationState, StorageErrorInitializationState } from "./training-application";

defineProps<{
  readonly initialization: StorageErrorInitializationState | DataErrorInitializationState;
}>();

const retry = (): void => {
  window.location.reload();
};
</script>

<template>
  <main class="app-shell error-shell">
    <p class="eyebrow">Train App</p>
    <h1>No se pudo abrir el almacenamiento local</h1>
    <p v-if="initialization.status === 'storage_error'">Revisa que el navegador permita almacenamiento local y vuelve a intentarlo.</p>
    <p v-else>Los datos locales no se pudieron preparar. Puedes volver a intentarlo sin perder los datos existentes.</p>
    <button type="button" @click="retry">Reintentar</button>
  </main>
</template>
