import VoltClient from '@/shared/infrastructure/api';
import type { ApiResponse } from '@/shared/types/api';
import type { Analysis, Trajectory, Team } from '@/types/models';
import type { ISearchRepository } from '../../domain/repositories';
import type { SearchResults } from '../../domain/entities';

export class SearchRepository implements ISearchRepository {
    private readonly analysisClient = new VoltClient('/analysis-config', { useRBAC: true });
    private readonly containerClient = new VoltClient('/containers', { useRBAC: true });
    private readonly trajectoryClient = new VoltClient('/trajectories', { useRBAC: true });
    private readonly teamClient = new VoltClient('/teams', { useRBAC: true });
    private readonly pluginClient = new VoltClient('/plugins', { useRBAC: true });

    async search(query: string): Promise<SearchResults> {
        if (!query.trim()) {
            return {
                analyses: [],
                containers: [],
                trajectories: [],
                teams: [],
                plugins: []
            };
        }

        const [analyses, containers, trajectories, teams, plugins] = await Promise.allSettled([
            this.analysisClient.request<ApiResponse<Analysis[]>>('get', '/', {
                query: { q: query, limit: 5 }
            }).then(res => res.data.data).catch(() => []),

            this.containerClient.request<ApiResponse<any[]>>('get', '/', {
                query: { q: query, limit: 5 }
            }).then(res => res.data.data).catch(() => []),

            this.trajectoryClient.request<ApiResponse<Trajectory[]>>('get', '/', {
                query: { q: query, limit: 5 }
            }).then(res => res.data.data).catch(() => []),

            this.teamClient.request<ApiResponse<Team[]>>('get', '/', {
                query: { q: query, limit: 5 }
            }).then(res => res.data.data).catch(() => []),

            this.pluginClient.request<ApiResponse<any[]>>('get', '/', {
                query: { q: query, limit: 5 }
            }).then(res => res.data.data).catch(() => [])
        ]);

        return {
            analyses: analyses.status === 'fulfilled' ? analyses.value : [],
            containers: containers.status === 'fulfilled' ? containers.value : [],
            trajectories: trajectories.status === 'fulfilled' ? trajectories.value : [],
            teams: teams.status === 'fulfilled' ? teams.value : [],
            plugins: plugins.status === 'fulfilled' ? plugins.value : []
        };
    }
}

export const searchRepository = new SearchRepository();
