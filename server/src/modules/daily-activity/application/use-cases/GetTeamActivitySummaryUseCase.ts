import { ErrorCodes } from '@core/constants/error-codes';
import type { DailyActivityRecord, IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

export interface GetTeamActivitySummaryInputDTO {
    teamId: string;
    /** Number of days to look back. Defaults to 7. */
    range?: number;
    /** When provided, scopes the summary to a single user. */
    userId?: string;
}

export interface GetTeamActivitySummaryOutputDTO {
    range: number;
    records: DailyActivityRecord[];
}

/**
 * Reads team daily-activity over a day range. Extracted from the inline
 * daily-activity route handler so the `get_activity_summary` AI tool (and any
 * other consumer) can reuse it instead of duplicating the repository call.
 */
@Singleton()
export default class GetTeamActivitySummaryUseCase
implements IUseCase<GetTeamActivitySummaryInputDTO, GetTeamActivitySummaryOutputDTO> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository) private readonly repository: IDailyActivityRepository
    ) {}

    async execute(input: GetTeamActivitySummaryInputDTO): Promise<GetTeamActivitySummaryOutputDTO> {
        const range = input.range !== undefined && Number.isFinite(input.range) && input.range > 0
            ? Math.floor(input.range)
            : 7;

        try {
            const records = await this.repository.findActivityByTeamId(input.teamId, range, { userId: input.userId });
            return { range, records };
        } catch (error: unknown) {
            logger.error(error, 'Failed to read team activity summary');

            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to read team activity summary',
                500
            );
        }
    }
}
