import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateTrajectoryByIdInputDTO, UpdateTrajectoryByIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/UpdateTrajectoryByIdDTO';

@injectable()
export default class UpdateTrajectoryByIdUseCase implements IUseCase<UpdateTrajectoryByIdInputDTO, UpdateTrajectoryByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: UpdateTrajectoryByIdInputDTO): Promise<Result<UpdateTrajectoryByIdOutputDTO, ApplicationError>>{
        const { trajectoryId, name, isPublic } = input;
        const result = await this.trajectoryRepo.updateById(trajectoryId, {
            name,
            isPublic
        });

        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }
        
        return Result.ok(result.props);
    }
};