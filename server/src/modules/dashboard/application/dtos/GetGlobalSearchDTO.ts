import type { GetAnalysesByTeamIdItemDTO } from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';
import type { ListContainersOutputDTO } from '@modules/container/application/dtos/ListContainersDTO';
import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';
import type { ListUserTeamsOutputDTO } from '@modules/team/application/dtos/team/ListUserTeamsDTO';
import type { TrajectoryPersistedDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoriesByTeamIdDTO';

export interface GetGlobalSearchInputDTO {
    teamId: string;
    userId: string;
    query?: string;
    limit?: number | string;
};

export interface GetGlobalSearchOutputDTO {
    analyses: GetAnalysesByTeamIdItemDTO[];
    containers: ListContainersOutputDTO['data'];
    trajectories: TrajectoryPersistedDTO[];
    teams: ListUserTeamsOutputDTO[];
    plugins: PersistedPluginDTO[];
    chats: PersistedChatDTO[];
};

export const EMPTY_GLOBAL_SEARCH_RESULTS: GetGlobalSearchOutputDTO = {
    analyses: [],
    containers: [],
    trajectories: [],
    teams: [],
    plugins: [],
    chats: []
};
