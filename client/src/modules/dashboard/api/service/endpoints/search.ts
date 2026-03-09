import { EMPTY_GLOBAL_SEARCH_RESULTS } from '../../dtos/global-search';
import { custom } from '@/app/core/http/utilities/create-service';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { Container } from '@/modules/container/api/entities/container';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { GlobalSearchInputDTO, GlobalSearchOutputDTO } from '../../dtos/global-search';

interface ApiResponse<T> {
    status: string;
    data: T;
};

interface SearchQueryParams extends Record<string, unknown> {
    search: string;
    limit: number;
};

interface CollectionClient {
    get: <TResponse>(path: string, query?: Record<string, unknown>) => Promise<TResponse>;
};

const fetchCollection = <T>(client: CollectionClient, query: string, limit: number): Promise<T[]> => {
    const params: SearchQueryParams = {
        search: query,
        limit
    };

    return client
        .get<ApiResponse<T[]>>('/', params)
        .then((response) => response.data)
        .catch((error: unknown) => {
            throw error;
        });
};

export default {
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

            let analysisResults: Analysis[] = [];
            if (analyses.status === 'fulfilled') {
                analysisResults = analyses.value;
            }

            let containerResults: Container[] = [];
            if (containers.status === 'fulfilled') {
                containerResults = containers.value;
            }

            let trajectoryResults: Trajectory[] = [];
            if (trajectories.status === 'fulfilled') {
                trajectoryResults = trajectories.value;
            }

            let teamResults: Team[] = [];
            if (teams.status === 'fulfilled') {
                teamResults = teams.value;
            }

            let pluginResults: Plugin[] = [];
            if (plugins.status === 'fulfilled') {
                pluginResults = plugins.value;
            }

            let chatResults: Chat[] = [];
            if (chats.status === 'fulfilled') {
                chatResults = chats.value;
            }

            return {
                analyses: analysisResults,
                containers: containerResults,
                trajectories: trajectoryResults,
                teams: teamResults,
                plugins: pluginResults,
                chats: chatResults
            };
        }
    )
};
