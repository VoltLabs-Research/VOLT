import type { PersistedChatDTO } from '@shared/contracts/ports';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import type { Analysis, ChatParticipant } from '@shared/contracts/types';
import { mapPluginToPersistedDTO } from '@shared/application/utilities/mapPluginToPersistedDTO';
import { TRAJECTORY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import type { TeamProps } from '@modules/team/models/team/TeamModel';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import type {
    GetAnalysesByTeamIdItemDTO,
    ListContainersOutputDTO,
    PersistedPluginDTO,
    TrajectoryPersistedDTO
} from '@shared/contracts/dtos';
import AnalysisRepository from '@modules/analysis/repositories/AnalysisRepository';
import { ContainerModel } from '@modules/container/models/ContainerModel';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import PluginRepository from '@modules/plugin/services/PluginRepository';
import TeamService from '@modules/team/services/TeamService';
import ChatModel from '@modules/chat/models/chat/ChatModel';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

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
    teams: PersistedOutput<TeamProps>[];
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

const toId = (value: unknown): string | undefined => (value === undefined || value === null ? undefined : String(value));

export default class DashboardService {
    #analysisRepository = new AnalysisRepository();
    #pluginRepository = new PluginRepository();
    #teamService = new TeamService();

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
            this.#searchTrajectoryIdsByTeamAndName(input.teamId, regex),
            this.#teamService.listUserTeams(input.userId),
            this.#findChatsByUserId(input.userId)
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
            this.#findContainers({
                filter: {
                    team: input.teamId,
                    name: { $regex: regex }
                },
                sort: { updatedAt: -1 },
                limit,
                page: 1
            }),
            this.#searchTrajectories(input.teamId, regex, limit),
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
            containers: (containersResult.data as unknown as ContainerSearchView[]).map((container) => ({
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
            trajectories: trajectoriesResult,
            teams: teams
                .filter((team) => matchesNormalizedQuery(
                    normalizedLowerCaseQuery,
                    team.name,
                    team.description
                ))
                .slice(0, limit),
            plugins: pluginsResult.data.map((plugin): PluginSearchDTO => mapPluginToPersistedDTO(plugin)),
            chats: (chats as unknown as PersistedChatDTO<ChatSearchView>[])
                .filter((chat) => matchesNormalizedQuery(
                    normalizedLowerCaseQuery,
                    getLastMessageContent(chat),
                    ...chat.participants.flatMap((participant) => getParticipantSearchTokens(participant))
                ))
                .slice(0, limit)
        };
    }

    async #findContainers(options: {
        filter: Record<string, unknown>;
        sort: Record<string, 1 | -1>;
        limit: number;
        page: number;
    }): Promise<PaginatedResult<Record<string, unknown>>> {
        const { filter, sort, limit, page } = options;

        const [docs, total] = await Promise.all([
            ContainerModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
            ContainerModel.countDocuments(filter)
        ]);

        const data = docs.map((doc) => ({
            ...doc,
            _id: String(doc._id),
            folder: toId(doc.folder) ?? null,
            createdBy: toId(doc.createdBy),
            team: toId(doc.team),
            teamCluster: toId(doc.teamCluster)
        }));

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async #searchTrajectoryIdsByTeamAndName(teamId: string, regex: RegExp): Promise<string[]> {
        const docs = await TrajectoryModel.find({ team: teamId, name: regex }).select('_id').lean().exec();
        return docs.map((doc) => doc._id.toString());
    }

    async #searchTrajectories(teamId: string, regex: RegExp, limit: number): Promise<TrajectoryPersistedDTO[]> {
        const docs = await TrajectoryModel.find({ team: teamId, name: regex })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean()
            .exec();

        return docs.map((doc) => ({
            _id: doc._id.toString(),
            name: doc.name,
            team: toId(doc.team) ?? '',
            folder: toId(doc.folder) ?? null,
            storageClusterId: toId(doc.storageClusterId),
            createdBy: toId(doc.createdBy) ?? '',
            status: doc.status,
            isPublic: doc.isPublic,
            rasterSceneViews: doc.rasterSceneViews,
            hasPreview: doc.hasPreview,
            stats: doc.stats,
            updatedAt: doc.updatedAt,
            createdAt: doc.createdAt
        }));
    }

    async #findChatsByUserId(userId: string): Promise<Array<Record<string, unknown>>> {
        const chats = await ChatModel.find({ participants: userId, isActive: true })
            .populate('lastMessage')
            .populate('participants')
            .sort({ lastMessageAt: -1 })
            .lean()
            .exec();

        return chats.map((chat) => ({ ...chat, _id: String(chat._id) }));
    }
}
