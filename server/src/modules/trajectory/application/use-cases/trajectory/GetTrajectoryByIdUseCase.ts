import { ErrorCodes } from '@core/constants/error-codes';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { resolveTrajectoryPreviewAvailability } from '@modules/trajectory/utilities/trajectory/resolve-trajectory-preview-availability';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryByIdDTO';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import type { ITrajectoryFrameRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFrameRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

interface GetTrajectoryByIdInput {
    trajectoryId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class GetTrajectoryByIdUseCase implements IUseCase<GetTrajectoryByIdInput, GetTrajectoryByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly repository: ITrajectoryRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryFrameRepository)
        private readonly frameRepository: ITrajectoryFrameRepository,
        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage
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
