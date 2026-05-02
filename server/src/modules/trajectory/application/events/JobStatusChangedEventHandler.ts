import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { inject } from 'tsyringe';

const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

@Singleton()
@Subscribe('job.status.changed')
export default class JobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        private readonly trajectoryRepo: TrajectoryRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { status, queueType, teamId, trajectoryId } = event.payload;

        if (!trajectoryId) return;
        if (queueType === RASTER_QUEUE_TYPE) return;

        // When any job starts running, ensure trajectory is in 'processing' state.
        // Only transition from pre-processing states to avoid overwriting terminal
        // states (Completed, Failed) when Redis events arrive out of order.
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
