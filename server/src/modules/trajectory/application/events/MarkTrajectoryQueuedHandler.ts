import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';

@injectable()
export class MarkTrajectoryQueuedHandler implements IEventHandler<PluginExecutionRequestEvent>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository
    ){}

    async handle(event: PluginExecutionRequestEvent): Promise<void>{
        const { trajectoryId } = event.payload;
        logger.info(`@mark-trajectory-queued-handler: marking trajectory ${trajectoryId} as queued`);
        await this.trajectoryRepo.updateById(trajectoryId, {
            status: TrajectoryStatus.Queued
        });
    }
};