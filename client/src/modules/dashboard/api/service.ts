import { createService, custom, get } from '@/app/core/http/utils/create-service';

import type { DashboardMetrics, DashboardMetricsBucket } from '@volt/contracts/modules/dashboard/domain';
import type { GlobalSearchResponse } from '@volt/contracts/modules/dashboard/domain';
import type { ApiResponse } from '@volt/contracts/shared/http';

export interface GlobalSearchInput {
    query: string;
    limit?: number;
}

export interface GetDashboardMetricsInput {
    days?: number;
    bucket?: DashboardMetricsBucket;
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

const endpoints = {
    getMetrics: get<GetDashboardMetricsInput, DashboardMetrics>('/trajectory-metrics', {
        client: 'metrics',
        query: ({ days, bucket }) => ({
            ...(days ? { days } : {}),
            ...(bucket ? { bucket } : {})
        })
    }),
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
        },
        metrics: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
