import type { FindActivityByTeamIdInputDTO } from '@modules/daily-activity/application/dtos/FindActivityByTeamIdDTO';
import type { PersistedDailyActivityDTO } from '@modules/daily-activity/application/dtos/PersistedDailyActivityDTO';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class FindActivityByTeamIdUseCase implements IUseCase<FindActivityByTeamIdInputDTO, PersistedDailyActivityDTO[], ApplicationError> {
    constructor(
        private dailyActivityRepository: DailyActivityRepository
    ) {}

    async execute(input: FindActivityByTeamIdInputDTO): Promise<Result<PersistedDailyActivityDTO[], ApplicationError>> {
        const { teamId, range } = input;
        const result = await this.dailyActivityRepository.findActivityByTeamId(teamId, range);

        return Result.ok(result);
    }
}
