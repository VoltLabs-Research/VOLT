import type { ITrajectoryFrameRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryFrameRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryRepository';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/dtos/trajectory/GetTrajectoryByIdDTO';

interface GetPublicCanvasTrajectoryInput {
    trajectoryId: string;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasTrajectoryUseCase implements IUseCase<
    GetPublicCanvasTrajectoryInput,
    GetTrajectoryByIdOutputDTO
> {
    constructor(

        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly repository: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryFrameRepository) private readonly frameRepository: ITrajectoryFrameRepository
    ) {}

    async execute(input: GetPublicCanvasTrajectoryInput): Promise<GetTrajectoryByIdOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const entity = await this.repository.findById(input.trajectoryId, {
            populate: ['team', 'analysis']
        });

        if (!entity) {
            throw ApplicationError.notFound(
                'Trajectory::NotFound',
                'Trajectory not found'
            );
        }

        entity.props.frames = await this.frameRepository.getFrames(entity.id);

        return toPersistedOutput(entity);
    }
};
