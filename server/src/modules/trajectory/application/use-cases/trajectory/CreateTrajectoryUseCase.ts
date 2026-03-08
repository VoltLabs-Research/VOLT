import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/CreateTrajectoryDTO';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { ITrajectoryBackgroundProcessor } from '@modules/trajectory/domain/port/trajectory/ITrajectoryBackgroundProcessor';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';
import path from 'node:path';

interface InitialTrajectoryStats {
    totalFiles: number;
    totalSize: number;
};

@injectable()
export default class CreateTrajectoryUseCase implements IUseCase<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryBackgroundProcessor)
        private readonly backgroundProcessor: ITrajectoryBackgroundProcessor,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTrajectoryInputDTO): Promise<Result<CreateTrajectoryOutputDTO, ApplicationError>> {
        const { name, teamId, userId, files } = input;

        const ext = path.extname(name);
        const cleanName = ext ? name.slice(0, -ext.length) : name;
        const stats: InitialTrajectoryStats = {
            totalFiles: 0,
            totalSize: 0
        };

        const trajectory = await this.trajectoryRepo.create({
            name: cleanName,
            team: teamId,
            createdBy: userId,
            status: TrajectoryStatus.WaitingForProcess,
            frames: [],
            stats,
            analysis: [],
            rasterSceneViews: 0,
            isPublic: true,
            updatedAt: new Date(),
            createdAt: new Date()
        });

        this.backgroundProcessor.process(trajectory._id, files, teamId).catch(async err => {
            logger.error(err, `[CreateTrajectoryUseCase] Background processing failed for ${trajectory._id}`);
            await this.trajectoryRepo.updateById(trajectory._id, { status: TrajectoryStatus.Failed }).catch(() => { });
        });

        await this.eventBus.publish(new TrajectoryCreatedEvent({
            trajectoryId: trajectory._id,
            trajectoryName: name,
            teamId,
            userId
        }));

        return Result.ok(toPersistedOutput(trajectory));
    }
};
