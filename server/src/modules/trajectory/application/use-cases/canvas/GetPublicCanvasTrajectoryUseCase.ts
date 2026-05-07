import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryByIdDTO';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';

interface GetPublicCanvasTrajectoryInput {
    trajectoryId: string;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasTrajectoryUseCase implements IUseCase<
    GetPublicCanvasTrajectoryInput,
    GetTrajectoryByIdOutputDTO,
    ApplicationError
> {
    constructor(

        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,


        private readonly repository: TrajectoryRepository,


        private readonly frameRepository: TrajectoryFrameRepository
    ) {}

    async execute(input: GetPublicCanvasTrajectoryInput): Promise<Result<GetTrajectoryByIdOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const entity = await this.repository.findById(input.trajectoryId, {
                populate: ['team', 'analysis']
            });

            if (!entity) {
                return Result.fail(ApplicationError.notFound(
                    'Trajectory::NotFound',
                    'Trajectory not found'
                ));
            }

            entity.props.frames = await this.frameRepository.getFrames(entity.id);

            // hasPreview comes from the persisted column. DaemonAnalysisCompletionService
            // flips it on after the rasterizer completes its first job per trajectory.
            return Result.ok(toPersistedOutput(entity));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
