import { useMemo } from 'react';
import { container } from 'tsyringe';
import { DAILY_ACTIVITY_TOKENS } from '@/modules/daily-activity/infrastructure/di/tokens';
import type IDailyActivityRepository from '@/modules/daily-activity/domain/ports/IDailyActivityRepository';

const useDailyActivityUseCases = () => {
    return useMemo(() => ({
        dailyActivityRepository: container.resolve<IDailyActivityRepository>(
            DAILY_ACTIVITY_TOKENS.DailyActivityRepository
        )
    }), []);
};

export default useDailyActivityUseCases;
