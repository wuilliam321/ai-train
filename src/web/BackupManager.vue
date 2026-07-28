<script setup lang="ts">
import { ref } from "vue";
import type { WebTrainingBackup } from "./training-application";
import type { TrainingOrchestrator } from "../core";

const props = defineProps<{
  readonly backup: WebTrainingBackup;
  readonly training: TrainingOrchestrator;
}>();

const error = ref<string | null>(null);
const message = ref<string | null>(null);

const exportBackup = async (): Promise<void> => {
  const serialized = await props.backup.exportData();
  const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "train-app-backup.json";
  link.click();
  URL.revokeObjectURL(url);
  message.value = "Copia local descargada.";
};

const importBackup = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file === undefined) {
    return;
  }

  const result = await props.backup.importData(await file.text());

  if (!result.ok) {
    error.value = "La copia no es compatible o está dañada. Los datos locales no cambiaron.";
    return;
  }

  message.value = "Copia restaurada. Se recargará la aplicación.";
  window.setTimeout(() => window.location.reload(), 250);
};

const resetProgress = async (): Promise<void> => {
  if (!window.confirm("Se eliminarán sesiones, historial, métricas y ciclos de programas. Los ejercicios y rutinas se conservarán.")) return;
  const result = await props.training.resetProgress();
  if (!result.ok) { error.value = "No se pudo restablecer el progreso local."; return; }
  message.value = "Progreso restablecido. Se recargará la aplicación.";
  window.setTimeout(() => window.location.reload(), 250);
};
</script>

<template>
  <section class="backup" aria-labelledby="backup-title">
    <header><p class="eyebrow">Datos locales</p><h2 id="backup-title">Respaldo</h2></header>
    <p>Exporta una copia JSON versionada para conservarla fuera del dispositivo o importar una copia válida.</p>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-if="message" class="success" role="status">{{ message }}</p>
    <div class="editor-card"><button type="button" @click="exportBackup">Exportar copia</button><label class="field">Importar copia <input type="file" accept="application/json,.json" @change="importBackup" /></label></div>
    <div class="editor-card"><strong>Restablecer progreso</strong><p>Conserva ejercicios, rutinas y programas; elimina sesiones, historial, métricas y ciclos.</p><button type="button" class="secondary-action" @click="resetProgress">Limpiar todo el progreso</button></div>
  </section>
</template>
