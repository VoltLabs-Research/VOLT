import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { JobStatus } from '@shared/contracts/types/JobStatus';
import type { JobStatusChangedEventPayload } from '@shared/contracts/events';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

const TRAJECTORY_LIFECYCLE_QUEUE_TYPES = new Set([
    'trajectory_glb_conversion',
    'trajectory_clone'
]);

@Subscribe('job.status.changed')
export default class JobStatusChangedEventHandler implements IEventHandler<IDomainEvent<JobStatusChangedEventPayload>> {
    #eventBus = eventBus;

    async handle(event: IDomainEvent<JobStatusChangedEventPayload>): Promise<void> {
        const { status, queueType, teamId, trajectoryId } = event.payload;

        if (!trajectoryId) return;
        if (!TRAJECTORY_LIFECYCLE_QUEUE_TYPES.has(queueType)) return;

        if (status === JobStatus.Running) {
            const trajectory = await TrajectoryModel.findById(trajectoryId);
            const currentStatus = trajectory?.status;
            const canTransition =
                currentStatus === TrajectoryStatus.WaitingForProcess ||
                currentStatus === TrajectoryStatus.Queued;

            if (trajectory && canTransition) {
                await TrajectoryModel.findByIdAndUpdate(trajectoryId, { $set: { status: TrajectoryStatus.Processing } }).exec();

                await this.#eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId,
                    teamId,
                    updates: { status: TrajectoryStatus.Processing },
                    updatedAt: new Date()
                }));
            }
        }
    }
}
