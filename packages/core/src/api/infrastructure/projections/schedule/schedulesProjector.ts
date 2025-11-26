import type { ScheduleEvent } from "../../../domain/schedule/events";
import { Projector } from "../_base/projector";

export class SchedulesProjector extends Projector<ScheduleEvent> {
  protected handlers = {
    'schedule.created': this.project.bind(this),
    'schedule.updated': this.project.bind(this),
    'schedule.executed': this.project.bind(this),
    'schedule.failed': this.project.bind(this),
    'schedule.cancelled': this.project.bind(this),
  };

  private async project(event: ScheduleEvent): Promise<void> {
    const state = event.payload.newState;
    this.repositories.schedulesReadModelRepository.save(state);
  }
}
