import { IDailyActivityRepository } from "../../domain/ports/IDailyActivityRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { AddDailyActivityInputDTO } from "../dto/AddDailyActivityDTO";
import { DAILY_ACTIVITY_TOKENS } from "../../infrastructure/di/DailyActivityTokens";
import { injectable, inject } from 'tsyringe';

// TODO: MAYBE UNUSED AND HANDLED BY EVENTS
@injectable()
export default class AddDailyActivityUseCase implements IUseCase<AddDailyActivityInputDTO, void, ApplicationError>{
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private dailyActivityRepository: IDailyActivityRepository
    ){}

    async execute(input: AddDailyActivityInputDTO): Promise<Result<void, ApplicationError>>{
        const { teamId, userId, type, description } = input;
        const result = await this.dailyActivityRepository.addDailyActivity(
            teamId, 
            userId, 
            type, 
            description
        );

        return Result.ok(result);
    }
}