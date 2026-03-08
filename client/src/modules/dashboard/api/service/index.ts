import { createService, custom } from '@/app/core/http/utilities/create-service';
import type {
    GlobalSearchInputDTO,
    GlobalSearchOutputDTO
} from '../dtos/global-search';
import { EMPTY_GLOBAL_SEARCH_RESULTS } from '../dtos/global-search';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { Container } from '@/modules/container/api/entities/container';
import type { Plugin } from '@/modules/plugin/api/entities/plugin';
import type { Team } from '@/modules/team/api/entities/team';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

interface ApiResponse<T> {
    status: string;
    data: T;
}

const fetchCollection = <T>(client: { get: <TResponse>(path: string, query?: Record<string, unknown>) => Promise<TResponse> }, query: string, limit: number): Promise<T[]> => {
    return client
        .get<ApiResponse<T[]>>('/', { q: query, limit })
        .then((response) => response.data)
        .catch(() => []);
};

const clients = {
    analysis: { basePath: '/analysis-config', useRBAC: true },
    container: { basePath: '/containers', useRBAC: true },
    trajectory: { basePath: '/trajectory', useRBAC: true },
    team: { basePath: '/teams', useRBAC: false },
    plugin: { basePath: '/plugins', useRBAC: true },
    chat: { basePath: '/chats', useRBAC: true }
};

const endpoints = {
    search: custom<GlobalSearchInputDTO, GlobalSearchOutputDTO>(
        async ({ clients }, { query, limit = 5 }) => {
            if (!query.trim()) {
                return EMPTY_GLOBAL_SEARCH_RESULTS;
            }

            const [analyses, containers, trajectories, teams, plugins, chats] = await Promise.allSettled([
                fetchCollection<Analysis>(clients.analysis, query, limit),
                fetchCollection<Container>(clients.container, query, limit),
                fetchCollection<Trajectory>(clients.trajectory, query, limit),
                fetchCollection<Team>(clients.team, query, limit),
                fetchCollection<Plugin>(clients.plugin, query, limit),
                fetchCollection<Chat>(clients.chat, query, limit)
            ]);

            return {
                analyses: analyses.status === 'fulfilled' ? analyses.value : [],
                containers: containers.status === 'fulfilled' ? containers.value : [],
                trajectories: trajectories.status === 'fulfilled' ? trajectories.value : [],
                teams: teams.status === 'fulfilled' ? teams.value : [],
                plugins: plugins.status === 'fulfilled' ? plugins.value : [],
                chats: chats.status === 'fulfilled' ? chats.value : []
            };
        }
    )
};

const service = createService({ clients }, endpoints);

export default service;
