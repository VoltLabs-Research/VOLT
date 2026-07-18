import { get } from '../../shared/routing';
import type { GlobalSearchResponse } from './domain';

/**
 * The team-scoped dashboard endpoints, typed by response. Full wire path
 * (team-scoped under `/api/dashboard/:teamId`), matching the previous
 * `createHttpModule({ basePath: '/api/dashboard/:teamId' })`. The `query` and
 * `limit` inputs arrive as query params.
 */
export const dashboardRoutes = {
    getGlobalSearch: get<GlobalSearchResponse>('/api/dashboard/:teamId/search')
} as const;
