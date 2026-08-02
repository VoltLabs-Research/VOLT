import { ILike, In } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import type { ChatRecord } from '@shared/contracts/ports';
import { mapPluginToRecord } from '@shared/application/utilities/mapPluginToRecord';
import type {
    GetAnalysesByTeamIdItemView,
    ListContainersOutput,
    PluginRecord,
    TrajectoryRecord
} from '@shared/contracts/operations';
import Analysis from '@modules/analysis/models/Analysis';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import Container from '@modules/container/models/Container';
import Plugin from '@modules/plugin/models/Plugin';
import Team from '@modules/team/models/Team';
import Trajectory from '@modules/trajectory/models/Trajectory';
import User from '@modules/auth/models/User';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import WorkflowProjectionService from '@modules/plugin/services/plugin/WorkflowProjection';
import TeamService from '@modules/team/services/TeamService';
import { isEntityId } from '@shared/infrastructure/persistence/entity-id';
import { paginate, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PageRequest } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';

interface ContainerSearchView{
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

interface ChatSearchParticipant{
    firstName: string;
    lastName: string;
    email: string;
}

interface ChatSearchLastMessage{
    content: string;
}

interface ChatSearchView{
    participants: ChatSearchParticipant[];
    lastMessage: ChatSearchLastMessage | null;
    isGroup: boolean;
    groupName: string;
}

interface PluginSearchProps{
    modifier?: { name: string } | null;
    exposures?: Array<{ _id: string; hasListing: boolean }>;
    listingExposures?: { exposures: Array<{ exposureId: string }> } | null;
    workflow?: unknown;
}

type PluginSearchRecord = PluginRecord<PluginSearchProps, unknown>;

interface GetGlobalSearchInput{
    teamId: string;
    userId: string;
    query?: string;
    limit?: number;
}

interface GetGlobalSearchResult{
    analyses: GetAnalysesByTeamIdItemView[];
    containers: ListContainersOutput<ContainerSearchView>['data'];
    trajectories: TrajectoryRecord[];
    teams: Team[];
    plugins: PluginSearchRecord[];
    chats: ChatRecord<ChatSearchView>[];
}

interface FindAnalysesOptions{
    teamId: string;
    search: string;
    searchPattern: string;
    trajectoryIds: string[];
    pageRequest: PageRequest;
}

const EMPTY_GLOBAL_SEARCH_RESULTS: GetGlobalSearchResult = {
    analyses: [],
    containers: [],
    trajectories: [],
    teams: [],
    plugins: [],
    chats: []
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MIN_SEARCH_QUERY_LENGTH = 2;
const LIKE_ESCAPE_CHARACTER = '\\';

const normalizeQuery = (value: string | undefined): string => value?.trim() ?? '';

const normalizeLimit = (value: number | undefined): number => {
    if(value === undefined || !Number.isFinite(value)){
        return DEFAULT_LIMIT;
    }
    return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
};

const escapeLikePattern = (value: string): string =>
    value.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE_CHARACTER}${character}`);

const containsPattern = (value: string): string => `%${escapeLikePattern(value)}%`;

const memberToken = (userId: string): string => `%,${escapeLikePattern(userId)},%`;

const participantCondition = (parameter: string): string =>
    `',' || COALESCE(chat.participants, '') || ',' LIKE :${parameter} ESCAPE '${LIKE_ESCAPE_CHARACTER}'`;

const matchesNormalizedQuery = (normalizedQuery: string, ...values: Array<string | null | undefined>): boolean =>
    values.some((value) => value?.toLowerCase().includes(normalizedQuery) ?? false);

const toAnalysisView = (analysis: Analysis): GetAnalysesByTeamIdItemView => ({
    ...analysis.toJSON(),
    _id: analysis.id,
    plugin: analysis.plugin,
    trajectory: analysis.trajectoryRef
        ? {
            _id: analysis.trajectoryRef.id,
            name: analysis.trajectoryRef.name
        }
        : analysis.trajectory
}) as GetAnalysesByTeamIdItemView;

const toTrajectoryRecord = (trajectory: Trajectory): TrajectoryRecord => ({
    _id: trajectory.id,
    name: trajectory.name,
    team: trajectory.team,
    folder: trajectory.folder,
    storageClusterId: trajectory.storageClusterId,
    createdBy: trajectory.createdBy,
    status: trajectory.status,
    isPublic: trajectory.isPublic,
    rasterSceneViews: trajectory.rasterSceneViews,
    hasPreview: trajectory.hasPreview,
    stats: trajectory.stats,
    updatedAt: trajectory.updatedAt,
    createdAt: trajectory.createdAt
});

const toPluginSearchRecord = (plugin: Plugin): PluginSearchRecord => {
    const workflow = new Workflow(plugin.id, plugin.workflow);
    const projection = WorkflowProjectionService.project(workflow, plugin.id);

    return mapPluginToRecord({
        _id: plugin.id,
        props: {
            team: plugin.team,
            status: plugin.status,
            modifier: plugin.modifier ?? projection.modifier,
            exposures: plugin.exposures ?? projection.exposures,
            arguments: plugin.arguments ?? projection.arguments,
            listingExposures: plugin.listingExposures ?? projection.listingExposures,
            producesExposures: projection.producesExposures,
            requiresExposures: projection.requiresExposures,
            createdAt: plugin.createdAt,
            updatedAt: plugin.updatedAt,
            workflow
        }
    }) as PluginSearchRecord;
};

export default class DashboardService{
    #teamService = new TeamService();

    async getGlobalSearch(input: GetGlobalSearchInput): Promise<GetGlobalSearchResult>{
        const normalizedQuery = normalizeQuery(input.query);
        if(normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH){
            return EMPTY_GLOBAL_SEARCH_RESULTS;
        }

        const limit = normalizeLimit(input.limit);
        const normalizedLowerCaseQuery = normalizedQuery.toLowerCase();
        const searchPattern = containsPattern(normalizedQuery);
        const pageRequest: PageRequest = {
            page: 1,
            limit
        };

        const [
            trajectoryIds,
            teams,
            chats
        ] = await Promise.all([
            this.#searchTrajectoryIdsByTeamAndName(input.teamId, searchPattern),
            this.#teamService.listUserTeams(input.userId),
            this.#findChatsByUserId(input.userId)
        ]);

        const [
            analysesResult,
            containersResult,
            trajectoriesResult,
            pluginsResult
        ] = await Promise.all([
            this.#findAnalyses({
                teamId: input.teamId,
                search: normalizedQuery,
                searchPattern,
                trajectoryIds,
                pageRequest
            }),
            this.#findContainers(input.teamId, searchPattern, pageRequest),
            this.#searchTrajectories(input.teamId, searchPattern, limit),
            this.#findPlugins(input.teamId, normalizedLowerCaseQuery, pageRequest)
        ]);

        return {
            analyses: analysesResult.data,
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
            plugins: pluginsResult.data,
            chats: (chats as unknown as ChatRecord<ChatSearchView>[])
                .filter((chat) => matchesNormalizedQuery(
                    normalizedLowerCaseQuery,
                    chat.lastMessage?.content,
                    ...chat.participants.flatMap((participant) => [
                        participant.firstName,
                        participant.lastName,
                        participant.email
                    ])
                ))
                .slice(0, limit)
        };
    }

    async #findAnalyses(options: FindAnalysesOptions): Promise<PaginatedResult<GetAnalysesByTeamIdItemView>>{
        const { teamId, search, searchPattern, trajectoryIds, pageRequest } = options;
        const where: FindOptionsWhere<Analysis>[] = [{
            team: teamId,
            pluginDisplayName: ILike(searchPattern)
        }];

        if(trajectoryIds.length > 0){
            where.push({
                team: teamId,
                trajectory: In(trajectoryIds)
            });
        }
        if(isEntityId(search)){
            where.push({
                team: teamId,
                id: search
            });
        }

        const [analyses, total] = await Analysis.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest),
            relations: { trajectoryRef: true }
        });

        return paginate([analyses.map((analysis) => toAnalysisView(analysis)), total], pageRequest);
    }

    async #findPlugins(teamId: string, normalizedLowerCaseQuery: string, pageRequest: PageRequest): Promise<PaginatedResult<PluginSearchRecord>>{
        const candidates = await Plugin.find({
            where: { team: teamId },
            select: {
                id: true,
                modifier: true,
                updatedAt: true
            }
        });

        const matches = candidates
            .filter((candidate) => matchesNormalizedQuery(
                normalizedLowerCaseQuery,
                candidate.modifier?.name,
                candidate.modifier?.description
            ))
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

        const skip = skipFor(pageRequest);
        const pageIds = matches.slice(skip, skip + pageRequest.limit).map((candidate) => candidate.id);
        const plugins = pageIds.length === 0 ? [] : await Plugin.findBy({ id: In(pageIds) });
        const pluginsById = new Map(plugins.map((plugin) => [plugin.id, plugin]));
        const data = pageIds.flatMap((pluginId) => {
            const plugin = pluginsById.get(pluginId);
            return plugin === undefined ? [] : [toPluginSearchRecord(plugin)];
        });

        return paginate([data, matches.length], pageRequest);
    }

    async #findContainers(teamId: string, searchPattern: string, pageRequest: PageRequest): Promise<PaginatedResult<Record<string, unknown>>>{
        const [containers, total] = await Container.findAndCount({
            where: {
                team: teamId,
                name: ILike(searchPattern)
            },
            order: { updatedAt: 'DESC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        });

        return paginate([containers.map((container) => container.toJSON()), total], pageRequest);
    }

    async #searchTrajectoryIdsByTeamAndName(teamId: string, searchPattern: string): Promise<string[]>{
        const trajectories = await Trajectory.find({
            where: {
                team: teamId,
                name: ILike(searchPattern)
            },
            select: { id: true }
        });

        return trajectories.map((trajectory) => trajectory.id);
    }

    async #searchTrajectories(teamId: string, searchPattern: string, limit: number): Promise<TrajectoryRecord[]>{
        const trajectories = await Trajectory.find({
            where: {
                team: teamId,
                name: ILike(searchPattern)
            },
            order: { updatedAt: 'DESC' },
            take: limit
        });

        return trajectories.map((trajectory) => toTrajectoryRecord(trajectory));
    }

    async #findChatsByUserId(userId: string): Promise<Array<Record<string, unknown>>>{
        const chats = await Chat.createQueryBuilder('chat')
            .where(participantCondition('member'), { member: memberToken(userId) })
            .andWhere('chat.isActive = :isActive', { isActive: true })
            .orderBy('chat.lastMessageAt', 'DESC', 'NULLS LAST')
            .getMany();

        const [participants, lastMessages] = await Promise.all([
            this.#loadUsers(chats.flatMap((chat) => chat.participants ?? [])),
            this.#loadMessages(chats.flatMap((chat) => (chat.lastMessage === null ? [] : [chat.lastMessage])))
        ]);

        return chats.map((chat) => ({
            ...chat.toJSON(),
            participants: this.#resolveUsers(chat.participants, participants),
            lastMessage: this.#resolveLastMessage(chat, lastMessages)
        }));
    }

    async #loadUsers(userIds: string[]): Promise<Map<string, User>>{
        const uniqueIds = Array.from(new Set(userIds));
        if(uniqueIds.length === 0) return new Map();

        const users = await User.findBy({ id: In(uniqueIds) });
        return new Map(users.map((user) => [user.id, user]));
    }

    async #loadMessages(messageIds: string[]): Promise<Map<string, ChatMessage>>{
        const uniqueIds = Array.from(new Set(messageIds));
        if(uniqueIds.length === 0) return new Map();

        const messages = await ChatMessage.findBy({ id: In(uniqueIds) });
        return new Map(messages.map((message) => [message.id, message]));
    }

    #resolveUsers(userIds: string[] | null, users: Map<string, User>): User[]{
        return (userIds ?? [])
            .map((userId) => users.get(userId))
            .filter((user): user is User => user !== undefined);
    }

    #resolveLastMessage(chat: Chat, messages: Map<string, ChatMessage>): ChatMessage | null{
        if(chat.lastMessage === null) return null;
        return messages.get(chat.lastMessage) ?? null;
    }
}
