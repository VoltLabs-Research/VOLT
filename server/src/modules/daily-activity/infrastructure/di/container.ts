import { container } from 'tsyringe';
import { DAILY_ACTIVITY_TOKENS } from './DailyActivityTokens';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import FindActivityByTeamIdUseCase from '@modules/daily-activity/application/use-cases/FindActivityByTeamIdUseCase';

import UpdateUserActivityUseCase from '@modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';

export const registerDailyActivityDependencies = () => {
    container.registerSingleton(DAILY_ACTIVITY_TOKENS.DailyActivityRepository, DailyActivityRepository);
    container.registerSingleton(DAILY_ACTIVITY_TOKENS.FindActivityByTeamIdUseCase, FindActivityByTeamIdUseCase);
    container.registerSingleton(DAILY_ACTIVITY_TOKENS.UpdateUserActivityUseCase, UpdateUserActivityUseCase);
};
