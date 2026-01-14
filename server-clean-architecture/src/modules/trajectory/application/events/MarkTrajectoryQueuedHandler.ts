import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { TRAJECTORY_TOKENS } from '../../infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '../../domain/port/ITrajectoryRepository';
import PluginExecutionRequestEvent from '@/src/modules/plugin/domain/events/PluginExecutionRequestEvent';
import logger from '@/src/shared/infrastructure/logger';
import { TrajectoryStatus } from '../../domain/entities/Trajectory';

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