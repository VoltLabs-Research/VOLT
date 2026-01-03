import VoltClient from '@/api';
import type { ApiResponse } from '@/types/api';
import type { Analysis, Trajectory, Team } from '@/types/models';

interface SearchResults {
    analyses: Analysis[];
    containers: any[];
    trajectories: Trajectory[];
    teams: Team[];
    plugins: any[];
}

const analysisClient = new VoltClient('/analysis-config', { useRBAC: true });
const containerClient = new VoltClient('/containers', { useRBAC: true });
const trajectoryClient = new VoltClient('/trajectories', { useRBAC: true });
const teamClient = new VoltClient('/teams', { useRBAC: true });
const pluginClient = new VoltClient('/plugins', { useRBAC: true });

export const searchApi = {
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
            analysisClient.request<ApiResponse<Analysis[]>>('get', '/', { 
                query: { q: query, limit: 5 } 
            }).then(res => res.data.data).catch(() => []),
            
            containerClient.request<ApiResponse<any[]>>('get', '/', { 
                query: { q: query, limit: 5 } 
            }).then(res => res.data.data).catch(() => []),
            
            trajectoryClient.request<ApiResponse<Trajectory[]>>('get', '/', { 
                query: { q: query, limit: 5 } 
            }).then(res => res.data.data).catch(() => []),
            
            teamClient.request<ApiResponse<Team[]>>('get', '/', { 
                query: { q: query, limit: 5 } 
            }).then(res => res.data.data).catch(() => []),
            
            pluginClient.request<ApiResponse<any[]>>('get', '/', { 
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
};
