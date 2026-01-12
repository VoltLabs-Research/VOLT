import { ITrajectoryRepository } from "../../domain/port/ITrajectoryRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from "../../infrastructure/di/TrajectoryTokens";
import { DeleteTrajectoryByIdInputDTO } from "../dtos/DeleteTrajectoryByIdDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class DeleteTrajectoryByIdUseCase implements IUseCase<DeleteTrajectoryByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: DeleteTrajectoryByIdInputDTO): Promise<Result<null, ApplicationError>>{
        const { trajectoryId } = input;
        const result = await this.trajectoryRepo.deleteById(trajectoryId);
        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }
        return Result.ok(null);
    }
};