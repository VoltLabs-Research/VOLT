import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { inject } from 'tsyringe';

@Subscribe('PluginExecutionRequest')
export class MarkTrajectoryQueuedHandler implements IEventHandler<PluginExecutionRequestEvent>{
    constructor(
        private readonly trajectoryRepo: TrajectoryRepository,
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
}