import { get } from '../../shared/routing';
import type { DailyActivity } from './domain';

export const dailyActivityRoutes = {
    getTeamActivitySummary: get<DailyActivity[]>('/api/teams/:teamId/daily-activities')
} as const;
