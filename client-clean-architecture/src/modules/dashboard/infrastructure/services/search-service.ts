import VoltClient from '@/app/core/http/VoltClient';
import { http } from '@/app/di';

export interface SearchResults {
    analyses: any[];
    containers: any[];
    trajectories: any[];
    teams: any[];
    plugins: any[];
    chats: any[];
};

interface ApiResponse<T> {
    status: string;
    data: T;
};

const EMPTY_RESULTS: SearchResults = {
    analyses: [],
    containers: [],
    trajectories: [],
    teams: [],
    plugins: [],
    chats: []
};

class SearchService {
    private readonly analysisClient = new VoltClient(http, '/analysis-config', { useRBAC: true });
    private readonly containerClient = new VoltClient(http, '/containers', { useRBAC: true });
    private readonly trajectoryClient = new VoltClient(http, '/trajectory', { useRBAC: true });
    private readonly teamClient = new VoltClient(http, '/teams', { useRBAC: false });
    private readonly pluginClient = new VoltClient(http, '/plugins', { useRBAC: true });
    private readonly chatClient = new VoltClient(http, '/chats', { useRBAC: true });

    async search(query: string): Promise<SearchResults> {
        if (!query.trim()) {
            return EMPTY_RESULTS;
        }

        const [analyses, containers, trajectories, teams, plugins, chats] = await Promise.allSettled([
            this.analysisClient.get<ApiResponse<any[]>>('/', { q: query, limit: 5 })
                .then(res => res.data)
                .catch(() => []),

            this.containerClient.get<ApiResponse<any[]>>('/', { q: query, limit: 5 })
                .then(res => res.data)
                .catch(() => []),

            this.trajectoryClient.get<ApiResponse<any[]>>('/', { q: query, limit: 5 })
                .then(res => res.data)
                .catch(() => []),

            this.teamClient.get<ApiResponse<any[]>>('/', { q: query, limit: 5 })
                .then(res => res.data)
                .catch(() => []),

            this.pluginClient.get<ApiResponse<any[]>>('/', { q: query, limit: 5 })
                .then(res => res.data)
                .catch(() => []),

            this.chatClient.get<ApiResponse<any[]>>('/', { q: query, limit: 5 })
                .then(res => res.data)
                .catch(() => [])
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
};

export const searchService = new SearchService();
