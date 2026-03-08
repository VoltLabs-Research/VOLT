import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import type { UpdateUserActivityInputDTO, UpdateUserActivityOutputDTO } from '@modules/daily-activity/application/dtos/UpdateUserActivityDTO';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class UpdateUserActivityUseCase implements IUseCase<UpdateUserActivityInputDTO, UpdateUserActivityOutputDTO, ApplicationError> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private readonly repository: IDailyActivityRepository
    ) {}

    async execute(input: UpdateUserActivityInputDTO): Promise<Result<UpdateUserActivityOutputDTO, ApplicationError>> {
        const { teamId, userId, durationInMinutes } = input;

        const date = new Date();
        date.setHours(0, 0, 0, 0);

        try {
            await this.repository.updateOnlineMinutes(teamId, userId, date, durationInMinutes);
            return Result.ok({ success: true });
        } catch (error: unknown) {
            logger.error(error, 'Failed to update user activity');

            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update activity stats',
                500
            ));
        }
    }
};
