import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { TRAJECTORY_TOKENS } from '@/src/modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@/src/modules/trajectory/domain/port/ITrajectoryRepository';
import JobStatusChangedEvent from '@/src/modules/jobs/application/events/JobStatusChangedEvent';
import { JobStatus } from '@/src/modules/jobs/domain/entities/Job';
import { TrajectoryStatus } from '@/src/modules/trajectory/domain/entities/Trajectory';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import TrajectoryUpdatedEvent from './TrajectoryUpdatedEvent';

@injectable()
export default class JobStatusChangedEventHandler implements IEventHandler<JobStatusChangedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) { }

    async handle(event: JobStatusChangedEvent): Promise<void> {
        const { status, metadata, teamId } = event.data;
        const trajectoryId = metadata?.trajectoryId;

        if (!trajectoryId) return;

        // When any job starts running, ensure trajectory is in 'processing' state
        if (status === JobStatus.Running) {
            const trajectory = await this.trajectoryRepo.findById(trajectoryId);
            if (trajectory && trajectory.props.status !== TrajectoryStatus.Processing) {
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
