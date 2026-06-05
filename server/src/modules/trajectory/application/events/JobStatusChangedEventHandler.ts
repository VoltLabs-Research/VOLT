import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import { inject } from 'tsyringe';

const TRAJECTORY_LIFECYCLE_QUEUE_TYPES = new Set([
    'trajectory_glb_conversion',
    'trajectory_clone'
]);

@Singleton()
@Subscribe('job.status.changed')
export default class JobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { status, queueType, teamId, trajectoryId } = event.payload;

        if (!trajectoryId) return;
        if (!TRAJECTORY_LIFECYCLE_QUEUE_TYPES.has(queueType)) return;

        // Only trajectory-owned queues control trajectory ingestion state.
        // Analysis jobs have their own status and must not move a trajectory
        // back out of Completed.
        if (status === JobStatus.Running) {
            const trajectory = await this.trajectoryRepo.findById(trajectoryId);
            const currentStatus = trajectory?.props.status;
            const canTransition =
                currentStatus === TrajectoryStatus.WaitingForProcess ||
                currentStatus === TrajectoryStatus.Queued;

            if (trajectory && canTransition) {
                await this.trajectoryRepo.updateById(trajectoryId, { status: TrajectoryStatus.Processing });

                await this.eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId,
                    teamId,
                    updates: { status: TrajectoryStatus.Processing },
                    updatedAt: new Date()
                }));
            }
        }
    }
}
