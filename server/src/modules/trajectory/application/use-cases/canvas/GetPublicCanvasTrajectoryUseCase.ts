import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { resolveTrajectoryPreviewAvailability } from '@modules/trajectory/utilities/trajectory/resolve-trajectory-preview-availability';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';


import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
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

        
        private readonly frameRepository: TrajectoryFrameRepository,

        
        private readonly rasterStorage: RasterStorageService
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
