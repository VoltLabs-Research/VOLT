import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryPreviewAvailability } from '@modules/trajectory/utilities/trajectory/resolve-trajectory-preview-availability';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';

import { injectable } from 'tsyringe';

import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryByIdDTO';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

interface GetTrajectoryByIdInput {
    trajectoryId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class GetTrajectoryByIdUseCase implements IUseCase<GetTrajectoryByIdInput, GetTrajectoryByIdOutputDTO, ApplicationError> {
    constructor(
        
        private readonly repository: TrajectoryRepository,
        
        private readonly frameRepository: TrajectoryFrameRepository,
        
        private readonly rasterStorage: RasterStorageService
    ) {}

    async execute(input: GetTrajectoryByIdInput): Promise<Result<GetTrajectoryByIdOutputDTO, ApplicationError>> {
        const entity = await this.repository.findById(input.trajectoryId, {
            populate: ['team', 'analysis']
        });
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        // Why: frames live in a separate collection (F2.S6). Hydrate them into
        // the props projection so existing HTTP consumers that expect
        // `trajectory.frames` keep working.
        entity.props.frames = await this.frameRepository.getFrames(entity.id);

        const persistedTrajectory = toPersistedOutput(entity);
        const trajectoryWithPreviewAvailability = await resolveTrajectoryPreviewAvailability(
            persistedTrajectory,
            this.rasterStorage.hasTrajectoryPreview.bind(this.rasterStorage)
        );

        return Result.ok(trajectoryWithPreviewAvailability);
    }
};
