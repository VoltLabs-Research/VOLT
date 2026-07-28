import { get } from '../../shared/routing';
import type { DailyActivity } from './domain';

export const dailyActivityRoutes = {
    getTeamActivitySummary: get<DailyActivity[]>('/api/daily-activities/:teamId')
} as const;
