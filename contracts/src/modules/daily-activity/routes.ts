import { get } from '../../shared/routing';
import type { DailyActivityRecord } from './domain';

export const dailyActivityRoutes = {
    getTeamActivitySummary: get<DailyActivityRecord[]>('/api/daily-activities/:teamId')
} as const;
