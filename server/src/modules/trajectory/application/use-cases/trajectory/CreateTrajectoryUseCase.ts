import { injectable, inject } from 'tsyringe';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/CreateTrajectoryDTO';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { ITrajectoryBackgroundProcessor } from '@modules/trajectory/domain/port/ITrajectoryBackgroundProcessor';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/TrajectoryCreatedEvent';
import path from 'node:path';

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

        const trajectory = await this.trajectoryRepo.create({
            name: cleanName,
            team: teamId,
            createdBy: userId,
            status: TrajectoryStatus.WaitingForProcess,
            frames: [],
            stats: { totalFiles: 0, totalSize: 0 },
            analysis: [],
            rasterSceneViews: 0,
            isPublic: true,
            updatedAt: new Date(),
            createdAt: new Date()
        });

        this.backgroundProcessor.process(trajectory.id, files, teamId).catch(async err => {
            console.error(`[CreateTrajectoryUseCase] Background processing failed for ${trajectory.id}:`, err);
            await this.trajectoryRepo.updateById(trajectory.id, { status: TrajectoryStatus.Failed }).catch(() => { });
        });

        await this.eventBus.publish(new TrajectoryCreatedEvent({
            trajectoryId: trajectory.id,
            trajectoryName: name,
            teamId,
            userId
        }));

        return Result.ok(trajectory.props);
    }
}