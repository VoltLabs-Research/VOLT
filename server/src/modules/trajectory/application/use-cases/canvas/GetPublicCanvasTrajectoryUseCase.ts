import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { resolveTrajectoryPreviewAvailability } from '@modules/trajectory/utilities/trajectory/resolve-trajectory-preview-availability';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryByIdDTO';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface GetPublicCanvasTrajectoryInput {
    trajectoryId: string;
    userId?: string;
};

@injectable()
export class GetPublicCanvasTrajectoryUseCase implements IUseCase<
    GetPublicCanvasTrajectoryInput,
    GetTrajectoryByIdOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly repository: ITrajectoryRepository,

        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage
    ) {}

    async execute(input: GetPublicCanvasTrajectoryInput): Promise<Result<GetTrajectoryByIdOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const entity = await this.repository.findById(input.trajectoryId, {
                populate: ['team', 'analysis', 'frames.simulationCell']
            });

            if (!entity) {
                return Result.fail(ApplicationError.notFound(
                    'Trajectory::NotFound',
                    'Trajectory not found'
                ));
            }

            const persistedTrajectory = toPersistedOutput(entity);
            const trajectoryWithPreviewAvailability = await resolveTrajectoryPreviewAvailability(
                persistedTrajectory,
                this.rasterStorage.hasTrajectoryPreview.bind(this.rasterStorage)
            );

            return Result.ok(trajectoryWithPreviewAvailability);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
