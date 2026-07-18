import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { inject } from 'tsyringe';
import type { ITrajectoryRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateTrajectoryByIdInputDTO, UpdateTrajectoryByIdOutputDTO } from '@modules/trajectory/dtos/trajectory/UpdateTrajectoryByIdDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';

import { injectable } from 'tsyringe';

@injectable()
export default class UpdateTrajectoryByIdUseCase implements IUseCase<UpdateTrajectoryByIdInputDTO, UpdateTrajectoryByIdOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: UpdateTrajectoryByIdInputDTO): Promise<UpdateTrajectoryByIdOutputDTO>{
        const { trajectoryId, name, isPublic } = input;
        const result = await this.trajectoryRepo.updateById(trajectoryId, {
            name,
            isPublic
        }, {
            populate: ['team', 'analysis']
        });

        if(!result){
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        return toPersistedOutput(result);
    }
}
