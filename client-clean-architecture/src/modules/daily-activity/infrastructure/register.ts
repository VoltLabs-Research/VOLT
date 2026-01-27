import { registerDailyActivityDependencies } from '../application/registry';
import { dailyActivityRepository } from './repositories/DailyActivityRepository';

export const registerDailyActivityInfrastructure = (): void => {
    registerDailyActivityDependencies({
        dailyActivityRepository
    });
};
