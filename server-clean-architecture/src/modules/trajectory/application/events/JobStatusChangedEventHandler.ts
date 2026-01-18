import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import JobStatusChangedEvent from '@modules/jobs/application/events/JobStatusChangedEvent';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
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
