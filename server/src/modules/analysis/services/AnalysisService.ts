import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import type { Analysis, AnalysisProps } from '@shared/contracts/types/AnalysisProps';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import {
    buildAnalysisRelationOptions,
    escapeLikePattern,
    findByTeamAndSearch,
    toAnalysisLike
} from '@modules/analysis/services/AnalysisQueries';
import { AnalysisRelation } from '@modules/analysis/contracts/domain/analysis';
import type { AnalysisRelationName } from '@modules/analysis/contracts/domain/analysis';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import TeamJobsService from '@modules/team/socket/team/TeamJobsService';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId
} from '@shared/application/utilities/cluster-location';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamJobMaintenanceService } from '@shared/contracts/ports';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { ILike } from 'typeorm';
import type { FindOptionsOrder, FindOptionsWhere } from 'typeorm';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type {
    GetAnalysesByTeamIdItemView,
    GetAnalysesByTrajectoryIdOutput
} from '@shared/contracts/operations';
import type {
    GetAnalysisFrameLogInput,
    GetAnalysisFrameLogOutput
} from '@shared/contracts/operations/GetAnalysisFrameLog';
import type { PaginatedResult } from '@shared/domain/port/persistence';

const LIST_DEFAULT_LIMIT = 100;

const NEWEST_FIRST: FindOptionsOrder<AnalysisEntity> = { createdAt: 'DESC' };

const LIST_RELATIONS: readonly AnalysisRelationName[] = [
    AnalysisRelation.Trajectory,
    AnalysisRelation.Plugin,
    AnalysisRelation.ComputeCluster,
    AnalysisRelation.StorageCluster,
    AnalysisRelation.CreatedBy
];

const TRAJECTORY_LIST_RELATIONS: readonly AnalysisRelationName[] = [
    AnalysisRelation.Trajectory,
    AnalysisRelation.Plugin
];

export interface GetAnalysesByTeamIdInput{
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export interface GetAnalysesByTrajectoryIdInput{
    trajectoryId: string;
    teamId?: string;
    page?: number;
    limit?: number;
}

export interface RetryFailedFramesInput{
    analysisId: string;
    teamId: string;
    userId: string;
}

export interface RetryFailedFramesResult{
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}

export interface GetAnalysisByIdInput{
    teamId?: string;
    analysisId: string;
}

export type GetAnalysisByIdResult = AnalysisProps & { _id: string };

export interface DeleteAnalysisByIdInput{
    teamId?: string;
    analysisId: string;
    userId?: string;
}

interface FindAllAnalysesOptions{
    where: FindOptionsWhere<AnalysisEntity>;
    relations?: readonly AnalysisRelationName[];
    order?: FindOptionsOrder<AnalysisEntity>;
    page?: number;
    limit?: number;
}

export default class AnalysisService{
    #executionLogService = analysisExecutionLogService;
    #teamJobMaintenanceService: ITeamJobMaintenanceService = teamJobMaintenanceService;
    #teamJobsService = new TeamJobsService();

    #eventBus = eventBus;

    async #searchTrajectoryIdsByTeamAndName(teamId: string, search: string): Promise<string[]>{
        const normalizedSearch = search.trim();
        if(!normalizedSearch){
            return [];
        }

        const trajectories = await Trajectory.find({
            where: {
                team: teamId,
                name: ILike(`%${escapeLikePattern(normalizedSearch)}%`)
            },
            select: { id: true }
        });

        return trajectories.map((trajectory) => trajectory.id);
    }

    async #findAllAnalyses(options: FindAllAnalysesOptions): Promise<PaginatedResult<Analysis>>{
        const { where, relations, order } = options;
        const pageRequest = readPageRequest(options.page, options.limit, { defaultLimit: LIST_DEFAULT_LIMIT });

        const [analyses, total] = await AnalysisEntity.findAndCount({
            where,
            ...buildAnalysisRelationOptions(relations),
            ...(order === undefined ? {} : { order }),
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([analyses.map((analysis) => toAnalysisLike(analysis)), total], pageRequest);
    }

    async getAnalysesByTeamId(input: GetAnalysesByTeamIdInput): Promise<PaginatedResult<GetAnalysesByTeamIdItemView>>{
        const { teamId } = input;
        const normalizedSearch = input.search?.trim();
        const hasSearch = Boolean(normalizedSearch);
        const where: FindOptionsWhere<AnalysisEntity> = { team: teamId };

        const results = hasSearch
            ? await findByTeamAndSearch({
                teamId,
                search: normalizedSearch!,
                trajectoryIds: await this.#searchTrajectoryIdsByTeamAndName(teamId, normalizedSearch!),
                relations: LIST_RELATIONS,
                limit: input.limit,
                page: input.page
            })
            : await this.#findAllAnalyses({
                where,
                relations: LIST_RELATIONS,
                order: NEWEST_FIRST,
                limit: input.limit,
                page: input.page
            });

        const mappedData = results.data.map((analysis: Analysis) => {
            const props = { ...analysis.props };
            const pluginId = extractPluginId(props.plugin);
            const trajectoryValue = props.trajectory as { name?: string } | string;
            const trajectoryName = typeof trajectoryValue === 'string' ? undefined : trajectoryValue?.name;

            return {
                ...props,
                _id: analysis._id,
                plugin: pluginId,
                trajectory: props.trajectory,
                computeClusterId: props.computeClusterId,
                storageClusterId: props.storageClusterId,
                createdBy: props.createdBy,
                trajectoryName
            };
        });

        return {
            ...results,
            data: mappedData
        } as unknown as PaginatedResult<GetAnalysesByTeamIdItemView>;
    }

    async getAnalysesByTrajectoryId(input: GetAnalysesByTrajectoryIdInput): Promise<GetAnalysesByTrajectoryIdOutput>{
        const where: FindOptionsWhere<AnalysisEntity> = { trajectory: input.trajectoryId };

        if(input.teamId){
            where.team = input.teamId;
        }

        const analyses = await this.#findAllAnalyses({
            where,
            relations: TRAJECTORY_LIST_RELATIONS,
            page: input.page,
            limit: input.limit,
            order: NEWEST_FIRST
        });

        const data = analyses.data.map((analysis) => {
            const props = { ...analysis.props };
            return {
                ...props,
                _id: analysis._id,
                plugin: extractPluginId(props.plugin)
            };
        });

        return {
            ...analyses,
            data
        } as unknown as GetAnalysesByTrajectoryIdOutput;
    }

    async getAnalysisFrameLog(input: GetAnalysisFrameLogInput): Promise<GetAnalysisFrameLogOutput>{
        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });

        if(!analysis){
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if(analysis.team !== input.teamId){
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        return this.#executionLogService.getFrameLog({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: analysis.trajectory,
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });
    }

    async retryFailedFrames(input: RetryFailedFramesInput): Promise<RetryFailedFramesResult>{
        const { analysisId, teamId } = input;

        const teamJobs = await this.#teamJobsService.getFlatTeamJobs(teamId);
        const failedTimesteps: number[] = [];
        const failedJobIds: string[] = [];
        let totalFrames = 0;
        let failedFrames = 0;

        for(const job of teamJobs){
            if(job.analysisId !== analysisId){
                continue;
            }

            totalFrames += 1;
            if(job.status !== 'failed'){
                continue;
            }

            failedFrames += 1;
            failedJobIds.push(job.jobId);
            const timestep = job.timestep;
            if(typeof timestep === 'number'){
                failedTimesteps.push(timestep);
            }
        }

        if(totalFrames === 0){
            const analysis = await AnalysisEntity.findOneBy({ id: analysisId });
            if(!analysis){
                throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
            }
            if(analysis.team !== teamId){
                throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
            }
        }

        if(failedFrames === 0){
            return {
                message: 'No failed frames found for this analysis',
                retriedFrames: 0,
                totalFrames,
                failedTimesteps: failedTimesteps.length > 0 ? failedTimesteps : undefined
            };
        }

        const retryResult = await this.#teamJobMaintenanceService.retryJobs(teamId, failedJobIds);

        return {
            message: retryResult.retriedFrames > 0
                ? `Requested retry for ${retryResult.retriedFrames} failed frame(s)`
                : 'No retriable failed frames found for this analysis',
            retriedFrames: retryResult.retriedFrames,
            totalFrames,
            failedTimesteps: failedTimesteps.length > 0 ? failedTimesteps : undefined
        };
    }

    async getAnalysisById(input: GetAnalysisByIdInput): Promise<GetAnalysisByIdResult>{
        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });

        if(!analysis){
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if(input.teamId && analysis.team !== input.teamId){
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        const persisted = toAnalysisLike(analysis);

        return {
            ...persisted.props,
            _id: persisted._id,
            plugin: extractPluginId(persisted.props.plugin)
        };
    }

    async deleteAnalysisById(input: DeleteAnalysisByIdInput): Promise<{ success: boolean }>{
        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });

        if(!analysis){
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if(input.teamId && analysis.team !== input.teamId){
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        const deleted = await AnalysisEntity.delete({ id: input.analysisId });

        if(deleted.affected === 0){
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        await this.#eventBus.emit('analysis.deleted', {
            analysisId: input.analysisId,
            trajectoryId: analysis.trajectory ?? '',
            pluginId: analysis.plugin ?? '',
            teamId: analysis.team ?? '',
            teamClusterId: resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId ?? undefined }),
            storageClusterId: resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId ?? undefined }),
            computeClusterId: resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined }),
            userId: input.userId ?? '',
            pluginDisplayName: analysis.pluginDisplayName
        });

        return { success: true };
    }
}
