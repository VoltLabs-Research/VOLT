import { ITrajectoryRepository } from "../../domain/port/ITrajectoryRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from "../../infrastructure/di/TrajectoryTokens";
import { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from "../dtos/CreateTrajectoryDTO";

@injectable()
export default class CreateTrajectoryUseCase implements IUseCase<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO, ApplicationError>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: CreateTrajectoryInputDTO): Promise<Result<CreateTrajectoryOutputDTO, ApplicationError>> {
        // TODO:
    }
};