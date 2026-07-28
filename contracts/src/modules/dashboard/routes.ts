import { get } from '../../shared/routing';
import type { GlobalSearchResponse } from './domain';

export const dashboardRoutes = {
    getGlobalSearch: get<GlobalSearchResponse>('/api/teams/:teamId/search')
} as const;
