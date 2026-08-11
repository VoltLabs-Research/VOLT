import { ILike, In } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { mapPluginToRecord } from '@shared/application/utilities/mapPluginToRecord';
import type { GetAnalysesByTeamIdItemView } from '@shared/contracts/operations/GetAnalysesByTeamId';
import type { PluginRecord } from '@shared/contracts/operations/PluginRecord';
import type { TrajectoryRecord } from '@shared/contracts/operations/GetTrajectoriesByTeamId';
import Analysis from '@modules/analysis/models/Analysis';
import Container from '@modules/container/models/Container';
import Plugin from '@modules/plugin/models/Plugin';
import Team from '@modules/team/models/Team';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import WorkflowProjectionService from '@modules/plugin/services/plugin/WorkflowProjection';
import TeamService from '@modules/team/services/TeamService';
import { isEntityId } from '@shared/infrastructure/persistence/entity-id';
import { paginate, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PageRequest } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';

type ContainerSearchRecord = {
    _id: string;
    name: string;
};

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
    containers: ContainerSearchRecord[];
    trajectories: TrajectoryRecord[];
    teams: Team[];
    plugins: PluginSearchRecord[];
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
    plugins: []
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MIN_SEARCH_QUERY_LENGTH = 2;
const LIKE_ESCAPE_CHARACTER = '\\';

const normalizeLimit = (value: number | undefined): number => {
    if(value === undefined || !Number.isFinite(value)){
        return DEFAULT_LIMIT;
    }
    return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
};

const escapeLikePattern = (value: string): string =>
    value.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE_CHARACTER}${character}`);

const containsPattern = (value: string): string => `%${escapeLikePattern(value)}%`;

const matchesNormalizedQuery = (normalizedQuery: string, ...values: Array<string | null | undefined>): boolean =>
    values.some((value) => value?.toLowerCase().includes(normalizedQuery) ?? false);

const toAnalysisView = (analysis: Analysis): GetAnalysesByTeamIdItemView => ({
    ...analysis.toJSON(),
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
        const normalizedQuery = input.query?.trim() ?? '';
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
            teams
        ] = await Promise.all([
            this.#searchTrajectoryIdsByTeamAndName(input.teamId, searchPattern),
            this.#teamService.listUserTeams(input.userId)
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
            containers: containersResult.data,
            trajectories: trajectoriesResult,
            teams: teams
                .filter((team) => matchesNormalizedQuery(
                    normalizedLowerCaseQuery,
                    team.name,
                    team.description
                ))
                .slice(0, limit),
            plugins: pluginsResult.data
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

    async #findContainers(teamId: string, searchPattern: string, pageRequest: PageRequest): Promise<PaginatedResult<ContainerSearchRecord>>{
        const [containers, total] = await Container.findAndCount({
            where: {
                team: teamId,
                name: ILike(searchPattern)
            },
            order: { updatedAt: 'DESC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        });

        return paginate([containers.map((container) => container.toJSON() as ContainerSearchRecord), total], pageRequest);
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
}
