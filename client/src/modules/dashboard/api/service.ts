import { createService, custom, get } from '@/app/core/http/utils/create-service';

import type { DashboardMetrics } from '@volt/contracts/modules/dashboard/domain';
import type { EmptyParams } from '@voltstack/voltclient';
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
    plugins: [],
    chats: []
};

interface SearchQueryParams extends Record<string, unknown> {
    query: string;
    limit: number;
}

export const MIN_SEARCH_QUERY_LENGTH = 2;

const endpoints = {
    getMetrics: get<EmptyParams, DashboardMetrics>('/trajectory-metrics', {
        client: 'metrics'
    }),
    search: custom<GlobalSearchInput, GlobalSearchResponse>(
        async ({ getClient }, { query, limit = 5 }) => {
            if (query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
                return EMPTY_GLOBAL_SEARCH_RESULTS;
            }

            const params: SearchQueryParams = {
                query,
                limit
            };

            const response = await getClient('dashboard').get<ApiResponse<GlobalSearchResponse>>('/search', params);
            return response.data;
        }
    )
};

export default createService({
    clients: {
        dashboard: {
            basePath: '/teams',
            useRBAC: true
        },
        metrics: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
