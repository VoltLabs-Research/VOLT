import useResolve from '@/shared/presentation/hooks/use-resolve';
import { DAILY_ACTIVITY_TOKENS } from '@/modules/daily-activity/infrastructure/di/tokens';
import type IDailyActivityRepository from '@/modules/daily-activity/domain/port/IDailyActivityRepository';

const useDailyActivityUseCases = () => {
    return {
        dailyActivityRepository: useResolve<IDailyActivityRepository>(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
    };
};

export default useDailyActivityUseCases;
