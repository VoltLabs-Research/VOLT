import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { CHAT_CONTRACT_TOKENS, CONTAINER_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import type {
    IAnalysisRepository,
    IChatRepository,
    IContainerRepository,
    IPluginRepository,
    ITrajectoryRepository,
    PersistedChatDTO
} from '@shared/contracts/ports';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import type { Analysis, ChatParticipant } from '@shared/contracts/types';
import { mapPluginToPersistedDTO } from '@shared/application/utilities/mapPluginToPersistedDTO';
import { TRAJECTORY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { ListUserTeamsOutputDTO } from '@modules/team/dtos/team/ListUserTeamsDTO';
import type {
    GetAnalysesByTeamIdItemDTO,
    ListContainersOutputDTO,
    PersistedPluginDTO,
    TrajectoryPersistedDTO
} from '@shared/contracts/dtos';
import { container as diContainer } from 'tsyringe';

/**
 * Neutral structural view of a container as surfaced by global search. Matches
 * the field set copied out of the container repository result and the
 * deep-linkable subset the UI/AI consume (`_id`, `name`). Collection-typed
 * fields are intentionally loose (`unknown[]`) — passed through, never read by
 * member.
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

export interface PluginSearchProps {
    modifier?: { name: string } | null;
    exposures?: Array<{ _id: string; hasListing: boolean }>;
    listingExposures?: { exposures: Array<{ exposureId: string }> } | null;
    workflow?: unknown;
}

export type PluginSearchDTO = PersistedPluginDTO<PluginSearchProps, unknown>;

export interface GetGlobalSearchInput {
    teamId: string;
    userId: string;
    query?: string;
    limit?: number;
}

export interface GetGlobalSearchResult {
    analyses: GetAnalysesByTeamIdItemDTO[];
    containers: ListContainersOutputDTO<ContainerSearchView>['data'];
    trajectories: TrajectoryPersistedDTO[];
    teams: ListUserTeamsOutputDTO[];
    plugins: PluginSearchDTO[];
    chats: PersistedChatDTO<ChatSearchView>[];
}

const EMPTY_GLOBAL_SEARCH_RESULTS: GetGlobalSearchResult = {
    analyses: [],
    containers: [],
    trajectories: [],
    teams: [],
    plugins: [],
    chats: []
};

type PluginEntity = Parameters<typeof mapPluginToPersistedDTO>[0];

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MIN_SEARCH_QUERY_LENGTH = 2;

const normalizeQuery = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeLimit = (value: unknown): number => {
    const parsedLimit = Number(value);
    if (!Number.isFinite(parsedLimit)) {
        return DEFAULT_LIMIT;
    }
    return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsedLimit)));
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesNormalizedQuery = (normalizedQuery: string, ...values: unknown[]): boolean =>
    values.some((value) => typeof value === 'string' && value.toLowerCase().includes(normalizedQuery));

const getParticipantSearchTokens = (participant: ChatParticipant): string[] => {
    if (typeof participant === 'string') {
        return [participant];
    }

    const searchTokens: string[] = [];
    const candidateRecord = participant as Record<string, unknown>;

    for (const key of ['firstName', 'lastName', 'email']) {
        const value = candidateRecord[key];
        if (typeof value === 'string' && value.length > 0) {
            searchTokens.push(value);
        }
    }

    return searchTokens;
};

const getLastMessageContent = (chat: PersistedChatDTO<ChatSearchView>): string | undefined => {
    const lastMessage = chat.lastMessage;
    if (typeof lastMessage !== 'object' || lastMessage === null) {
        return undefined;
    }
    const content = (lastMessage as Record<string, unknown>).content;
    return typeof content === 'string' ? content : undefined;
};

/**
 * The single application service for the dashboard module (pollium style):
 * folds the former GetGlobalSearchUseCase verbatim. Dashboard owns no data of
 * its own — global search is a read fan-out across other modules, so the six
 * source repositories are resolved once from the DI container via their neutral
 * cross-module tokens (the same tokens their owning modules register, e.g.
 * container's `ContainerSearchRepository` / analysis's model-backed search
 * adapter). Throws typed `ApplicationError`s from the underlying repos.
 */
export default class DashboardService {
    // Cross-module read repositories, resolved once from the DI container via
    // neutral tokens (owning modules register the concrete adapters):
    #analysisRepository = diContainer.resolve<IAnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository);
    #containerRepository = diContainer.resolve<IContainerRepository<ContainerSearchView>>(CONTAINER_CONTRACT_TOKENS.ContainerRepository);
    #trajectoryRepository = diContainer.resolve<ITrajectoryRepository>(COMPUTE_TOKENS.TrajectoryRepository);
    #pluginRepository = diContainer.resolve<IPluginRepository<PluginEntity>>(COMPUTE_TOKENS.PluginRepository);
    #teamRepository = diContainer.resolve<ITeamRepository>(TEAM_CONTRACT_TOKENS.TeamRepository);
    #chatRepository = diContainer.resolve<IChatRepository<unknown, ChatSearchView>>(CHAT_CONTRACT_TOKENS.ChatRepository);

    async getGlobalSearch(input: GetGlobalSearchInput): Promise<GetGlobalSearchResult> {
        const normalizedQuery = normalizeQuery(input.query);
        if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
            return EMPTY_GLOBAL_SEARCH_RESULTS;
        }

        const limit = normalizeLimit(input.limit);
        const normalizedLowerCaseQuery = normalizedQuery.toLowerCase();
        const regex = new RegExp(escapeRegex(normalizedQuery), 'i');

        const [
            trajectoryIds,
            teams,
            chats
        ] = await Promise.all([
            this.#trajectoryRepository.searchIdsByTeamAndName(input.teamId, normalizedQuery),
            this.#teamRepository.findUserTeams(input.userId),
            this.#chatRepository.findChatsByUserId(input.userId)
        ]);

        const [
            analysesResult,
            containersResult,
            trajectoriesResult,
            pluginsResult
        ] = await Promise.all([
            this.#analysisRepository.findByTeamAndSearch({
                teamId: input.teamId,
                search: normalizedQuery,
                trajectoryIds,
                limit,
                page: 1,
                populate: [TRAJECTORY_POPULATE]
            }),
            this.#containerRepository.findAll({
                filter: {
                    team: input.teamId,
                    name: { $regex: regex }
                },
                sort: { updatedAt: -1 },
                limit,
                page: 1
            }),
            this.#trajectoryRepository.findAll({
                filter: {
                    team: input.teamId,
                    name: { $regex: regex }
                },
                sort: { updatedAt: -1 },
                limit,
                page: 1
            }),
            this.#pluginRepository.findAll({
                filter: {
                    team: input.teamId,
                    $or: [
                        { 'modifier.name': { $regex: regex } },
                        { 'modifier.description': { $regex: regex } }
                    ]
                },
                sort: { updatedAt: -1 },
                limit,
                page: 1
            })
        ]);

        return {
            analyses: analysesResult.data.map((analysis: Analysis) => ({
                ...analysis.props,
                _id: analysis._id,
                plugin: extractPluginId(analysis.props.plugin),
                trajectory: analysis.props.trajectory
            })),
            containers: containersResult.data.map((container) => ({
                _id: container._id,
                name: container.name,
                image: container.image,
                containerId: container.containerId,
                folder: container.folder,
                createdBy: container.createdBy,
                status: container.status,
                memory: container.memory,
                cpus: container.cpus,
                internalIp: container.internalIp,
                team: container.team,
                teamCluster: container.teamCluster,
                env: container.env,
                ports: container.ports,
                network: container.network,
                volume: container.volume,
                mountDockerSocket: container.mountDockerSocket,
                accessiblePorts: container.accessiblePorts,
                createdAt: container.createdAt,
                updatedAt: container.updatedAt
            })),
            trajectories: trajectoriesResult.data.map((trajectory) => toPersistedOutput(trajectory)),
            teams: teams
                .filter((team) => matchesNormalizedQuery(
                    normalizedLowerCaseQuery,
                    team.name,
                    team.description
                ))
                .slice(0, limit),
            plugins: pluginsResult.data.map((plugin): PluginSearchDTO => mapPluginToPersistedDTO(plugin)),
            chats: chats
                .filter((chat) => matchesNormalizedQuery(
                    normalizedLowerCaseQuery,
                    getLastMessageContent(chat),
                    ...chat.participants.flatMap((participant) => getParticipantSearchTokens(participant))
                ))
                .slice(0, limit)
        };
    }
}
