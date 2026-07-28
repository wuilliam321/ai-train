import type { ProgressRepository, TrainingChangePublisher } from "../ports";
import type { ApplicationResult } from "./contracts";
import { failure, success } from "./result";

export class ProgressService {
  private readonly progress: ProgressRepository;
  private readonly events: TrainingChangePublisher;

  constructor(dependencies: { readonly progress: ProgressRepository; readonly events: TrainingChangePublisher }) {
    this.progress = dependencies.progress;
    this.events = dependencies.events;
  }

  async reset(): ApplicationResult<void> {
    const cleared = await this.progress.clearProgress();
    if (!cleared.ok) return failure({ code: "persistence", details: { code: cleared.error.code } });
    this.events.publish({ activeWorkout: null, restPeriod: null });
    return success(undefined);
  }
}
