import { container } from 'tsyringe';
import { DAILY_ACTIVITY_TOKENS } from './DailyActivityTokens';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';

import UpdateUserActivityUseCase from '@modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';

export const registerDailyActivityDependencies = () => {
    container.registerSingleton(DAILY_ACTIVITY_TOKENS.DailyActivityRepository, DailyActivityRepository);
    container.register(DAILY_ACTIVITY_TOKENS.UpdateUserActivityUseCase, {
        useClass: UpdateUserActivityUseCase
    });
};
