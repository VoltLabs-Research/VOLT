import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateTrajectoryByIdInputDTO, UpdateTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/UpdateTrajectoryByIdDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';

import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class UpdateTrajectoryByIdUseCase implements IUseCase<UpdateTrajectoryByIdInputDTO, UpdateTrajectoryByIdOutputDTO, ApplicationError>{
    constructor(
        private readonly trajectoryRepo: TrajectoryRepository
    ){}

    async execute(input: UpdateTrajectoryByIdInputDTO): Promise<Result<UpdateTrajectoryByIdOutputDTO, ApplicationError>>{
        const { trajectoryId, name, isPublic } = input;
        const result = await this.trajectoryRepo.updateById(trajectoryId, {
            name,
            isPublic
        }, {
            populate: ['team', 'analysis']
        });

        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        return Result.ok(toPersistedOutput(result));
    }
}
