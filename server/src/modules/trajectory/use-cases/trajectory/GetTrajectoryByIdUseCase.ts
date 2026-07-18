import type { ITrajectoryFrameRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryFrameRepository';
import { inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';

import { injectable } from 'tsyringe';

import type { GetTrajectoryByIdOutputDTO } from '@modules/trajectory/dtos/trajectory/GetTrajectoryByIdDTO';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

interface GetTrajectoryByIdInput {
    trajectoryId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class GetTrajectoryByIdUseCase implements IUseCase<GetTrajectoryByIdInput, GetTrajectoryByIdOutputDTO> {
    constructor(

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly repository: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryFrameRepository) private readonly frameRepository: ITrajectoryFrameRepository
    ) {}

    async execute(input: GetTrajectoryByIdInput): Promise<GetTrajectoryByIdOutputDTO> {
        const entity = await this.repository.findById(input.trajectoryId, {
            populate: ['team', 'analysis']
        });
        if (!entity) {
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        entity.props.frames = await this.frameRepository.getFrames(entity.id);

        return toPersistedOutput(entity);
    }
};
