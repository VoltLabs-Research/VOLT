import type TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import { inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';

import { injectable } from 'tsyringe';

import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryByIdDTO';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

interface GetTrajectoryByIdInput {
    trajectoryId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class GetTrajectoryByIdUseCase implements IUseCase<GetTrajectoryByIdInput, GetTrajectoryByIdOutputDTO, ApplicationError> {
    constructor(

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly repository: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryFrameRepository) private readonly frameRepository: TrajectoryFrameRepository
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

        // hasPreview is the persisted column; DaemonAnalysisCompletionService
        // sets it true on the first successful raster job. No bucket scan here.
        return Result.ok(toPersistedOutput(entity));
    }
};
