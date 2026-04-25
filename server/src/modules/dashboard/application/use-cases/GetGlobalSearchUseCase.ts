import { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import type { Analysis } from '@modules/analysis/domain/entities/Analysis';
import {
    EMPTY_GLOBAL_SEARCH_RESULTS,
    GetGlobalSearchInputDTO,
    GetGlobalSearchOutputDTO
} from '@modules/dashboard/application/dtos/GetGlobalSearchDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { IUseCase } from '@shared/application/IUseCase';
import { TRAJECTORY_POPULATE } from '@shared/application/PopulatePresets';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type { ChatParticipant } from '@modules/chat/domain/entities/chat/Chat';
import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';

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

const getLastMessageContent = (chat: PersistedChatDTO): string | undefined => {
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
        
        private readonly analysisRepository: AnalysisRepository,

        
        private readonly containerRepository: ContainerRepository,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly pluginRepository: PluginRepository,

        
        private readonly teamRepository: TeamRepository,

        
        private readonly chatRepository: ChatRepository
    ) {}

    async execute(input: GetGlobalSearchInputDTO): Promise<Result<GetGlobalSearchOutputDTO>> {
        const normalizedQuery = normalizeQuery(input.query);
        if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
            return Result.ok(EMPTY_GLOBAL_SEARCH_RESULTS);
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

        return Result.ok({
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
            plugins: pluginsResult.data.map((plugin): PersistedPluginDTO => mapPluginToPersistedDTO(plugin)),
            chats: chats
                .filter((chat) => {
                    return matchesNormalizedQuery(
                        normalizedLowerCaseQuery,
                        getLastMessageContent(chat),
                        ...chat.participants.flatMap((participant) => getParticipantSearchTokens(participant))
                    );
                })
                .slice(0, limit)
        });
    }
}
