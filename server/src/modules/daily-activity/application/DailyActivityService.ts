import GetTeamActivitySummaryUseCase, {
    type GetTeamActivitySummaryInputDTO,
    type GetTeamActivitySummaryOutputDTO
} from '@modules/daily-activity/application/use-cases/GetTeamActivitySummaryUseCase';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single application service for the daily-activity module. `getTeamActivitySummary`
 * folds the previously inline route handler's read path, converting the Result
 * error channel to thrown `ApplicationError`s so Express 5 forwards them to the
 * global error middleware. The underlying {@link GetTeamActivitySummaryUseCase}
 * is retained because the `get_activity_summary` AI tool consumes it directly;
 * this method delegates and unwraps the Result for the HTTP path.
 * `UpdateUserActivityUseCase` remains event-driven only and is not exposed here.
 */
@Singleton(DAILY_ACTIVITY_TOKENS.DailyActivityService)
export default class DailyActivityService {
    constructor(
        @inject(GetTeamActivitySummaryUseCase) private readonly getTeamActivitySummaryUseCase: GetTeamActivitySummaryUseCase
    ) {}

    async getTeamActivitySummary(input: GetTeamActivitySummaryInputDTO): Promise<GetTeamActivitySummaryOutputDTO> {
        const result = await this.getTeamActivitySummaryUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }
}
