// The chat/container/plugin result shapes now come from the neutral contracts
// layer (`@shared/contracts`). Those contract DTOs/ports are GENERIC over the
// owner entity/props (they default to `unknown`), so this aggregator binds them
// to its OWN structural "search view" types below — the minimal field set the
// global-search response actually exposes — instead of importing the concrete
// `@modules/{chat,container,plugin}` shapes.
//
// The analysis item view + trajectory persisted view now come from the neutral
// contracts layer (`@shared/contracts/dtos`), so this aggregator no longer
// imports the analysis/trajectory modules for those shapes.
// `ListUserTeamsOutputDTO` is from the KERNEL team module and is allowed.
import type { ListUserTeamsOutputDTO } from '@modules/team/application/dtos/team/ListUserTeamsDTO';
import type {
    GetAnalysesByTeamIdItemDTO,
    ListContainersOutputDTO,
    PersistedPluginDTO,
    TrajectoryPersistedDTO
} from '@shared/contracts/dtos';
import type { ChatParticipant } from '@shared/contracts/types';
import type { PersistedChatDTO } from '@shared/contracts/ports';

/**
 * Neutral structural view of a container as surfaced by global search. Matches
 * the field set the use case copies out of the container repository result and
 * the deep-linkable subset the UI/AI consume (`_id`, `name`). Collection-typed
 * fields are intentionally loose (`unknown[]`) — they are passed through, never
 * read by member.
 */
export interface ContainerSearchView {
    _id: string;
    name: string;
    image: string;
    containerId: string;
    folder: string | null;
    createdBy: string;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team?: string;
    teamCluster?: string;
    env: unknown[];
    ports: unknown[];
    network?: string;
    volume?: string;
    mountDockerSocket?: boolean;
    accessiblePorts?: unknown[];
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Neutral structural view of the chat props global search reads: participant
 * list + last-message content (for the text match) and the group metadata the
 * UI surfaces. Binds the generic `PersistedChatDTO` contract.
 */
export interface ChatSearchView {
    participants: ChatParticipant[];
    lastMessage: string;
    isGroup: boolean;
    groupName: string;
}

/**
 * Neutral structural view of the plugin props global search reads. Binds the
 * generic `PersistedPluginDTO` contract; the concrete `mapPluginToPersistedDTO`
 * output (full plugin DTO) is assignable to this narrower shape.
 */
export interface PluginSearchProps {
    modifier?: { name: string } | null;
    exposures?: Array<{ _id: string; hasListing: boolean }>;
    listingExposures?: { exposures: Array<{ exposureId: string }> } | null;
    workflow?: unknown;
}

export type PluginSearchDTO = PersistedPluginDTO<PluginSearchProps, unknown>;

export interface GetGlobalSearchInputDTO {
    teamId: string;
    userId: string;
    query?: string;
    limit?: number;
}

export interface GetGlobalSearchOutputDTO {
    analyses: GetAnalysesByTeamIdItemDTO[];
    containers: ListContainersOutputDTO<ContainerSearchView>['data'];
    trajectories: TrajectoryPersistedDTO[];
    teams: ListUserTeamsOutputDTO[];
    plugins: PluginSearchDTO[];
    chats: PersistedChatDTO<ChatSearchView>[];
}

export const EMPTY_GLOBAL_SEARCH_RESULTS: GetGlobalSearchOutputDTO = {
    analyses: [],
    containers: [],
    trajectories: [],
    teams: [],
    plugins: [],
    chats: []
};
