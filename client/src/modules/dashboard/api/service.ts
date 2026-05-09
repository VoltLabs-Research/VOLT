import { createService, custom, get } from '@/app/core/http/utilities/create-service';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { Container } from '@/modules/container/api/entities/container';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import type { DashboardMetrics } from './entities/dashboard';
import type { EmptyParams } from '@voltstack/voltclient';

export interface GlobalSearchInputDTO {
    query: string;
    limit?: number;
}

export interface GlobalSearchOutputDTO {
    analyses: Analysis[];
    containers: Container[];
    trajectories: Trajectory[];
    teams: Team[];
    plugins: Plugin[];
    chats: Chat[];
}

export type GlobalSearchSectionKey = keyof GlobalSearchOutputDTO;

export const EMPTY_GLOBAL_SEARCH_RESULTS: GlobalSearchOutputDTO = {
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

const MIN_SEARCH_QUERY_LENGTH = 2;

const endpoints = {
    getMetrics: get<EmptyParams, DashboardMetrics>('/metrics', {
        client: 'metrics'
    }),
    search: custom<GlobalSearchInputDTO, GlobalSearchOutputDTO>(
        async ({ getClient }, { query, limit = 5 }) => {
            if (query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
                return EMPTY_GLOBAL_SEARCH_RESULTS;
            }

            const params: SearchQueryParams = {
                query,
                limit
            };

            const response = await getClient('dashboard').get<ApiResponse<GlobalSearchOutputDTO>>('/search', params);
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
        analysis: {
            basePath: '/analyses',
            useRBAC: true
        },
        container: {
            basePath: '/containers',
            useRBAC: true
        },
        trajectory: {
            basePath: '/trajectories',
            useRBAC: true
        },
        team: {
            basePath: '/teams',
            useRBAC: false
        },
        plugin: {
            basePath: '/plugins',
            useRBAC: true
        },
        chat: {
            basePath: '/chats',
            useRBAC: false
        },
        metrics: {
            basePath: '/trajectories',
            useRBAC: true
        }
    }
}, endpoints);
