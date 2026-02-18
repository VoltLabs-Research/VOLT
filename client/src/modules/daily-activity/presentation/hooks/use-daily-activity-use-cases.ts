import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { DAILY_ACTIVITY_TOKENS } from '@/modules/daily-activity/infrastructure/di/tokens';
import type IDailyActivityRepository from '@/modules/daily-activity/domain/ports/IDailyActivityRepository';

const useDailyActivityUseCases = createUseCasesHook({
    dailyActivityRepository: DAILY_ACTIVITY_TOKENS.DailyActivityRepository
}) as () => {
    dailyActivityRepository: IDailyActivityRepository;
};

export default useDailyActivityUseCases;
