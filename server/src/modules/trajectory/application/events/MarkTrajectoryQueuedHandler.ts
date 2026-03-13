import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';

@injectable()
export class MarkTrajectoryQueuedHandler implements IEventHandler<PluginExecutionRequestEvent>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async handle(event: PluginExecutionRequestEvent): Promise<void>{
        const { trajectoryId, teamId } = event.payload;
        logger.info(`@mark-trajectory-queued-handler: marking trajectory ${trajectoryId} as queued`);
        await this.trajectoryRepo.updateById(trajectoryId, {
            status: TrajectoryStatus.Queued
        });

        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: { status: TrajectoryStatus.Queued },
            updatedAt: new Date()
        }));
    }
};