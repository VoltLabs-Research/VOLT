import { IDailyActivityRepository } from "../../domain/ports/IDailyActivityRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { FindActivityByTeamIdInputDTO, FindActivityByTeamIdOutputDTO } from "../dto/FindActivityByTeamIdDTO";
import { DAILY_ACTIVITY_TOKENS } from '../../infrastructure/di/DailyActivityTokens';
import { injectable, inject } from "tsyringe";

@injectable()
export default class FindActivityByTeamIdUseCase implements IUseCase<FindActivityByTeamIdInputDTO, FindActivityByTeamIdOutputDTO[], ApplicationError>{
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private dailyActivityRepository: IDailyActivityRepository
    ){}

    async execute(input: FindActivityByTeamIdInputDTO): Promise<Result<FindActivityByTeamIdOutputDTO[], ApplicationError>> {
        const { teamId, range } = input;
        const result = await this.dailyActivityRepository.findActivityByTeamId(teamId, range);
        
        return Result.ok(result);
    }
};