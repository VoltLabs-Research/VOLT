import { IDailyActivityRepository } from '@modules/daily-activity/domain/ports/IDailyActivityRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { FindActivityByTeamIdInputDTO, FindActivityByTeamIdOutputDTO } from '@modules/daily-activity/application/dto/FindActivityByTeamIdDTO';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { injectable, inject } from 'tsyringe';

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