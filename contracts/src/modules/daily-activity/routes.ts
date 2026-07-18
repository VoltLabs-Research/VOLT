import { get } from '../../shared/routing';
import type { DailyActivityRecord } from './domain';

/**
 * The team-scoped daily-activity read endpoint, typed by response. Full wire
 * path (team-scoped under `/api/daily-activities/:teamId`), matching the
 * previous `createHttpModule({ basePath: '/api/daily-activities/:teamId' })`.
 * The `range` (days) and `scope` (`team` | `self`) inputs arrive as query
 * params. Responds with the flat records array.
 */
export const dailyActivityRoutes = {
    getTeamActivitySummary: get<DailyActivityRecord[]>('/api/daily-activities/:teamId')
} as const;
