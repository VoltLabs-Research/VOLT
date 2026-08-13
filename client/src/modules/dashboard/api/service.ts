import { createService, custom } from '@/app/core/http/utils/create-service';

import type { GlobalSearchResponse } from '@volt/contracts/modules/dashboard/domain';
import type { ApiResponse } from '@volt/contracts/shared/http';

export interface GlobalSearchInput {
    query: string;
    limit?: number;
}

export type GlobalSearchSectionKey = keyof GlobalSearchResponse;

export const EMPTY_GLOBAL_SEARCH_RESULTS: GlobalSearchResponse = {
    analyses: [],
    containers: [],
    trajectories: [],
    teams: [],
    plugins: []
};

export const MIN_SEARCH_QUERY_LENGTH = 2;

/*
 * The trajectory-metrics endpoint is deliberately absent: the dashboard no
 * longer shows metrics. The route still exists server-side for the AI tools, so
 * re-add a client method here if a view ever needs it again.
 */
const endpoints = {
    search: custom<GlobalSearchInput, GlobalSearchResponse>(
        async ({ getClient }, { query, limit = 5 }) => {
            if (query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
                return EMPTY_GLOBAL_SEARCH_RESULTS;
            }

            const response = await getClient('dashboard').get<ApiResponse<GlobalSearchResponse>>('/search', {
                query,
                limit
            });

            return response.data;
        }
    )
};

export default createService({
    clients: {
        dashboard: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
