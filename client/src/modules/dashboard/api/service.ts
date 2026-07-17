import { createService, custom, get } from '@/app/core/http/utilities/create-service';
import type { Analysis } from '@/modules/analysis/api/types/analysis';
import type { Chat } from '@/modules/chat/api/types/chat';
import type { Container } from '@/modules/container/api/types/container';
import type { Plugin } from '@/modules/plugin/api/types/plugin/plugin';
import type { Team } from '@/modules/team/api/types/team/team';
import type { Trajectory } from '@/modules/trajectory/api/types/trajectory/trajectory';
import type { DashboardMetrics } from './types/dashboard';
import type { EmptyParams } from '@voltstack/voltclient';

export interface GlobalSearchInput {
    query: string;
    limit?: number;
}

export interface GlobalSearchResponse {
    analyses: Analysis[];
    containers: Container[];
    trajectories: Trajectory[];
    teams: Team[];
    plugins: Plugin[];
    chats: Chat[];
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

interface ApiResponse<T> {
    status: string;
    data: T;
}

interface SearchQueryParams extends Record<string, unknown> {
    query: string;
    limit: number;
}

export const MIN_SEARCH_QUERY_LENGTH = 2;

const endpoints = {
    getMetrics: get<EmptyParams, DashboardMetrics>('/metrics', {
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
            basePath: '/dashboard',
            useRBAC: true
        },
        metrics: {
            basePath: '/trajectories',
            useRBAC: true
        }
    }
}, endpoints);
