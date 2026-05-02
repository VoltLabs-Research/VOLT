import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { Container } from '@/modules/container/api/entities/container';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

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
