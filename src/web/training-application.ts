import { createWebStorageTrainingEnvironment } from "../adapters/web-storage";
import type { WebStorageTrainingEnvironmentOptions } from "../adapters/web-storage";
import { loadBaseData } from "../base-data/load";
import type { BaseDataLoadResult } from "../base-data/load";
import { TrainingOrchestrator } from "../core";
import type { ApplicationError, PersistenceResult } from "../core";

export interface WebTrainingBackup {
  exportData(): Promise<string>;
  importData(serialized: string): PersistenceResult<void>;
}

export interface ReadyInitializationState {
  readonly status: "ready";
  readonly baseData: BaseDataLoadResult;
}

export interface StorageErrorInitializationState {
  readonly status: "storage_error";
}

export interface DataErrorInitializationState {
  readonly status: "data_error";
  readonly error: ApplicationError;
}

export type WebTrainingInitializationState =
  | ReadyInitializationState
  | StorageErrorInitializationState
  | DataErrorInitializationState;

export type WebTrainingApplication =
  | {
      readonly training: TrainingOrchestrator;
      readonly backup: WebTrainingBackup;
      readonly initialization: ReadyInitializationState;
    }
  | {
      readonly initialization: StorageErrorInitializationState | DataErrorInitializationState;
    };

export const createWebTrainingApplication = async (
  options: WebStorageTrainingEnvironmentOptions = {},
): Promise<WebTrainingApplication> => {
  let training: TrainingOrchestrator;
  let backup: WebTrainingBackup;

  try {
    const environment = createWebStorageTrainingEnvironment(options);
    training = new TrainingOrchestrator(environment.dependencies);
    backup = {
      exportData: environment.exportData,
      importData: environment.importData,
    };
  } catch {
    return { initialization: { status: "storage_error" } };
  }

  const loaded = await loadBaseData(training);

  if (!loaded.ok) {
    return loaded.error.code === "persistence"
      ? { initialization: { status: "storage_error" } }
      : { initialization: { status: "data_error", error: loaded.error } };
  }

  return {
    training,
    backup,
    initialization: {
      status: "ready",
      baseData: loaded.value,
    },
  };
};
