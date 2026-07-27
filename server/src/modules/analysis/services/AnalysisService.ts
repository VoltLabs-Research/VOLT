import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import type { Analysis, AnalysisProps } from '@shared/contracts/types/AnalysisProps';
import AnalysisModel, { findByTeamAndSearch, toAnalysisLike, type AnalysisDocument } from '@modules/analysis/models/AnalysisModel';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import AnalysisDeletedEvent from '@modules/analysis/events/AnalysisDeletedEvent';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import TeamJobsService from '@modules/team/socket/team/TeamJobsService';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId
} from '@shared/application/utilities/cluster-location';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ITeamJobMaintenanceService } from '@shared/contracts/ports';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import type {
    GetAnalysesByTeamIdItemView,
    GetAnalysesByTrajectoryIdOutput
} from '@shared/contracts/operations';
import type {
    GetAnalysisFrameLogInput,
    GetAnalysisFrameLogOutput
} from '@shared/contracts/operations/GetAnalysisFrameLog';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import {
    COMPUTE_CLUSTER_POPULATE,
    STORAGE_CLUSTER_POPULATE,
    TRAJECTORY_POPULATE,
    USER_POPULATE
} from '@shared/infrastructure/persistence/mongo/PopulatePresets';

export interface GetAnalysesByTeamIdInput {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export interface GetAnalysesByTrajectoryIdInput {
    trajectoryId: string;
    teamId?: string;
    page?: number;
    limit?: number;
}

export interface RetryFailedFramesInput {
    analysisId: string;
    teamId: string;
    userId: string;
}

export interface RetryFailedFramesResult {
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}

export interface GetAnalysisByIdInput {
    teamId?: string;
    analysisId: string;
}

export type GetAnalysisByIdResult = AnalysisProps & { _id: string };

export interface DeleteAnalysisByIdInput {
    teamId?: string;
    analysisId: string;
    userId?: string;
}

interface FindAllAnalysesOptions {
    filter: Record<string, unknown>;
    populate?: unknown;
    sort?: Record<string, 1 | -1>;
    page?: number;
    limit?: number;
}

export default class AnalysisService {
    #executionLogService = analysisExecutionLogService;
    #teamJobMaintenanceService: ITeamJobMaintenanceService = teamJobMaintenanceService;
    #teamJobsService = new TeamJobsService();

    #eventBus = eventBus;

    async #searchTrajectoryIdsByTeamAndName(teamId: string, search: string): Promise<string[]> {
        const normalizedSearch = search.trim();
        if (!normalizedSearch) {
            return [];
        }

        const regex = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const docs = await TrajectoryModel.find({ team: teamId, name: regex }).select('_id').lean().exec();

        return docs.map((doc) => doc._id.toString());
    }

    async #findAllAnalyses(options: FindAllAnalysesOptions): Promise<PaginatedResult<Analysis>> {
        const { filter, populate, sort, page = 1, limit = 100 } = options;
        const skip = (page - 1) * limit;

        let query = AnalysisModel.find(filter).skip(skip).limit(limit) as any;
        if (populate) query = query.populate(populate as any);
        if (sort) query = query.sort(sort);

        const [docs, total] = await Promise.all([
            query.exec() as Promise<AnalysisDocument[]>,
            AnalysisModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => toAnalysisLike(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getAnalysesByTeamId(input: GetAnalysesByTeamIdInput): Promise<PaginatedResult<GetAnalysesByTeamIdItemView>> {
        const { teamId } = input;
        const normalizedSearch = input.search?.trim();
        const hasSearch = Boolean(normalizedSearch);
        const filter: Record<string, unknown> = { team: teamId };
        const sort = { createdAt: -1 } as const;

        const populate = [
            TRAJECTORY_POPULATE,
            { path: 'plugin' },
            COMPUTE_CLUSTER_POPULATE,
            STORAGE_CLUSTER_POPULATE,
            USER_POPULATE
        ];

        const results = hasSearch
            ? await findByTeamAndSearch({
                teamId,
                search: normalizedSearch!,
                trajectoryIds: await this.#searchTrajectoryIdsByTeamAndName(teamId, normalizedSearch!),
                populate,
                limit: input.limit,
                page: input.page
            })
            : await this.#findAllAnalyses({
                filter,
                populate,
                sort,
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

    async getAnalysesByTrajectoryId(input: GetAnalysesByTrajectoryIdInput): Promise<GetAnalysesByTrajectoryIdOutput> {
        const filter: Record<string, unknown> = { trajectory: input.trajectoryId };
        const sort = { createdAt: -1 } as const;

        if (input.teamId) {
            filter.team = input.teamId;
        }

        const analyses = await this.#findAllAnalyses({
            filter,
            populate: [
                TRAJECTORY_POPULATE,
                { path: 'plugin' }
            ],
            page: input.page,
            limit: input.limit,
            sort
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

    async getAnalysisFrameLog(input: GetAnalysisFrameLogInput): Promise<GetAnalysisFrameLogOutput> {
        const analysis = await AnalysisModel.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if (analysis.team.toString() !== input.teamId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        return this.#executionLogService.getFrameLog({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: analysis.trajectory.toString(),
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });
    }

    async retryFailedFrames(input: RetryFailedFramesInput): Promise<RetryFailedFramesResult> {
        const { analysisId, teamId } = input;

        const teamJobs = await this.#teamJobsService.getFlatTeamJobs(teamId);
        const failedTimesteps: number[] = [];
        const failedJobIds: string[] = [];
        let totalFrames = 0;
        let failedFrames = 0;

        for (const job of teamJobs) {
            if (job.analysisId !== analysisId) {
                continue;
            }

            totalFrames += 1;
            if (job.status !== 'failed') {
                continue;
            }

            failedFrames += 1;
            failedJobIds.push(job.jobId);
            const timestep = job.timestep;
            if (typeof timestep === 'number') {
                failedTimesteps.push(timestep);
            }
        }

        if (totalFrames === 0) {
            const analysis = await AnalysisModel.findById(analysisId);
            if (!analysis) {
                throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
            }
            if (analysis.team.toString() !== teamId) {
                throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
            }
        }

        if (failedFrames === 0) {
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

    async getAnalysisById(input: GetAnalysisByIdInput): Promise<GetAnalysisByIdResult> {
        const analysis = await AnalysisModel.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if (input.teamId && analysis.team.toString() !== input.teamId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        const persisted = toAnalysisLike(analysis);

        return {
            ...persisted.props,
            _id: persisted._id,
            plugin: extractPluginId(persisted.props.plugin)
        };
    }

    async deleteAnalysisById(input: DeleteAnalysisByIdInput): Promise<{ success: boolean }> {
        const analysis = await AnalysisModel.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if (input.teamId && analysis.team.toString() !== input.teamId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        const deleted = await AnalysisModel.findByIdAndDelete(input.analysisId);

        if (!deleted) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        await this.#eventBus.publish(new AnalysisDeletedEvent({
            analysisId: input.analysisId,
            trajectoryId: analysis.trajectory?.toString() ?? '',
            pluginId: analysis.plugin?.toString() ?? '',
            teamId: analysis.team?.toString() ?? '',
            teamClusterId: resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId?.toString() }),
            storageClusterId: resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId?.toString() }),
            computeClusterId: resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId?.toString() }),
            userId: input.userId ?? '',
            pluginDisplayName: analysis.pluginDisplayName
        }));

        return { success: true };
    }
}
