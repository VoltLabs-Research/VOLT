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
import {
    EMPTY_GLOBAL_SEARCH_RESULTS,
    GetGlobalSearchInputDTO,
    GetGlobalSearchOutputDTO
} from '@modules/dashboard/dtos/GetGlobalSearchDTO';
import type {
    ChatSearchView,
    ContainerSearchView,
    PluginSearchDTO
} from '@modules/dashboard/dtos/GetGlobalSearchDTO';
import { mapPluginToPersistedDTO } from '@shared/application/utilities/mapPluginToPersistedDTO';
import { IUseCase } from '@shared/application/IUseCase';
import { TRAJECTORY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { inject, injectable } from 'tsyringe';

type PluginEntity = Parameters<typeof mapPluginToPersistedDTO>[0];

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MIN_SEARCH_QUERY_LENGTH = 2;

const normalizeQuery = (value: unknown): string => {
    return typeof value === 'string' ? value.trim() : '';
};

const normalizeLimit = (value: unknown): number => {
    const parsedLimit = Number(value);

    if (!Number.isFinite(parsedLimit)) {
        return DEFAULT_LIMIT;
    }

    return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsedLimit)));
};

const escapeRegex = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const matchesNormalizedQuery = (normalizedQuery: string, ...values: unknown[]): boolean => {
    return values.some((value) => {
        return typeof value === 'string' && value.toLowerCase().includes(normalizedQuery);
    });
};

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

@injectable()
export default class GetGlobalSearchUseCase
implements IUseCase<GetGlobalSearchInputDTO, GetGlobalSearchOutputDTO> {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(CONTAINER_CONTRACT_TOKENS.ContainerRepository) private readonly containerRepository: IContainerRepository<ContainerSearchView>,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(COMPUTE_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository<PluginEntity>,
        @inject(TEAM_CONTRACT_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(CHAT_CONTRACT_TOKENS.ChatRepository) private readonly chatRepository: IChatRepository<unknown, ChatSearchView>
    ) {}

    async execute(input: GetGlobalSearchInputDTO): Promise<GetGlobalSearchOutputDTO> {
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
            this.trajectoryRepository.searchIdsByTeamAndName(input.teamId, normalizedQuery),
            this.teamRepository.findUserTeams(input.userId),
            this.chatRepository.findChatsByUserId(input.userId)
        ]);

        const [
            analysesResult,
            containersResult,
            trajectoriesResult,
            pluginsResult
        ] = await Promise.all([
            this.analysisRepository.findByTeamAndSearch({
                teamId: input.teamId,
                search: normalizedQuery,
                trajectoryIds,
                limit,
                page: 1,
                populate: [TRAJECTORY_POPULATE]
            }),
            this.containerRepository.findAll({
                filter: {
                    team: input.teamId,
                    name: { $regex: regex }
                },
                sort: { updatedAt: -1 },
                limit,
                page: 1
            }),
            this.trajectoryRepository.findAll({
                filter: {
                    team: input.teamId,
                    name: { $regex: regex }
                },
                sort: { updatedAt: -1 },
                limit,
                page: 1
            }),
            this.pluginRepository.findAll({
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
                .filter((chat) => {
                    return matchesNormalizedQuery(
                        normalizedLowerCaseQuery,
                        getLastMessageContent(chat),
                        ...chat.participants.flatMap((participant) => getParticipantSearchTokens(participant))
                    );
                })
                .slice(0, limit)
        };
    }
}
