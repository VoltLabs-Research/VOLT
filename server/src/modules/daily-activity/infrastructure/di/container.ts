import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import FindActivityByTeamIdUseCase from '@modules/daily-activity/application/use-cases/FindActivityByTeamIdUseCase';
import UpdateUserActivityUseCase from '@modules/daily-activity/application/use-cases/UpdateUserActivityUseCase';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerDailyActivityDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [DAILY_ACTIVITY_TOKENS.DailyActivityRepository, DailyActivityRepository],
            [DAILY_ACTIVITY_TOKENS.FindActivityByTeamIdUseCase, FindActivityByTeamIdUseCase],
            [DAILY_ACTIVITY_TOKENS.UpdateUserActivityUseCase, UpdateUserActivityUseCase]
        ]
    });
};
