import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import logger from '@shared/infrastructure/logger';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';

@injectable()
export class MarkTrajectoryQueuedHandler implements IEventHandler<PluginExecutionRequestEvent>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository
    ){}

    async handle(event: PluginExecutionRequestEvent): Promise<void>{
        logger.info(`@mark-trajectory-queued-handler: marking trajectory ${event.trajectoryId} as queued`);
        await this.trajectoryRepo.updateById(event.trajectoryId, {
            status: TrajectoryStatus.Queued
        });
    }
};