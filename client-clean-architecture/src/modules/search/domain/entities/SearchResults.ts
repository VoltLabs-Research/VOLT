import type { Analysis, Trajectory, Team } from '@/types/models';

export interface SearchResults {
    analyses: Analysis[];
    containers: any[];
    trajectories: Trajectory[];
    teams: Team[];
    plugins: any[];
    chats?: any[];
}
