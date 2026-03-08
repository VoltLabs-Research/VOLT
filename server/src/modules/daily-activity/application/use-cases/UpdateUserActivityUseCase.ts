import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';
import { UpdateUserActivityInputDTO, UpdateUserActivityOutputDTO } from '@modules/daily-activity/application/dto/UpdateUserActivityDTO';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class UpdateUserActivityUseCase implements IUseCase<UpdateUserActivityInputDTO, UpdateUserActivityOutputDTO, ApplicationError> {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private readonly repository: IDailyActivityRepository
    ){}

    async execute(input: UpdateUserActivityInputDTO): Promise<Result<UpdateUserActivityOutputDTO, ApplicationError>> {
        const { teamId, userId, durationInMinutes } = input;

        // Use the current date for the update
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
}
