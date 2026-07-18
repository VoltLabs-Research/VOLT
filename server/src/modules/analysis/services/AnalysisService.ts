import { ErrorCodes } from '@core/constants/error-codes';
import type { Analysis, AnalysisProps } from '@modules/analysis/entities/Analysis';
import type AnalysisRepository from '@modules/analysis/repositories/AnalysisRepository';
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
    GetAnalysesByTeamIdItemDTO,
    GetAnalysesByTrajectoryIdOutputDTO
} from '@shared/contracts/dtos';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@shared/contracts/dtos/GetAnalysisFrameLogDTO';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import {
    COMPUTE_CLUSTER_POPULATE,
    STORAGE_CLUSTER_POPULATE,
    TRAJECTORY_POPULATE,
    USER_POPULATE
} from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { container as diContainer } from 'tsyringe';

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

interface TeamAnalysesFilter extends Partial<AnalysisProps> {
    team: string;
}

interface TrajectoryAnalysesFilter extends Partial<AnalysisProps> {
    trajectory: string;
    team?: string;
}

export default class AnalysisService {
    #analysisRepo = diContainer.resolve<AnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository);
    #executionLogService = analysisExecutionLogService;
    #teamJobMaintenanceService: ITeamJobMaintenanceService = teamJobMaintenanceService;
    #teamJobsService = diContainer.resolve(TeamJobsService);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    async #searchTrajectoryIdsByTeamAndName(teamId: string, search: string): Promise<string[]> {
        const normalizedSearch = search.trim();
        if (!normalizedSearch) {
            return [];
        }

        const regex = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const docs = await TrajectoryModel.find({ team: teamId, name: regex }).select('_id').lean().exec();

        return docs.map((doc) => doc._id.toString());
    }

    async getAnalysesByTeamId(input: GetAnalysesByTeamIdInput): Promise<PaginatedResult<GetAnalysesByTeamIdItemDTO>> {
        const { teamId } = input;
        const normalizedSearch = input.search?.trim();
        const hasSearch = Boolean(normalizedSearch);
        const filter: TeamAnalysesFilter = { team: teamId };
        const sort = { createdAt: -1 } as const;

        const populate = [
            TRAJECTORY_POPULATE,
            { path: 'plugin' },
            COMPUTE_CLUSTER_POPULATE,
            STORAGE_CLUSTER_POPULATE,
            USER_POPULATE
        ];

        const results = hasSearch
            ? await this.#analysisRepo.findByTeamAndSearch({
                teamId,
                search: normalizedSearch!,
                trajectoryIds: await this.#searchTrajectoryIdsByTeamAndName(teamId, normalizedSearch!),
                populate,
                limit: input.limit,
                page: input.page
            })
            : await this.#analysisRepo.findAll({
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
        } as unknown as PaginatedResult<GetAnalysesByTeamIdItemDTO>;
    }

    async getAnalysesByTrajectoryId(input: GetAnalysesByTrajectoryIdInput): Promise<GetAnalysesByTrajectoryIdOutputDTO> {
        const filter: TrajectoryAnalysesFilter = { trajectory: input.trajectoryId };
        const sort = { createdAt: -1 } as const;

        if (input.teamId) {
            filter.team = input.teamId;
        }

        const analyses = await this.#analysisRepo.findAll({
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
        } as unknown as GetAnalysesByTrajectoryIdOutputDTO;
    }

    async getAnalysisFrameLog(input: GetAnalysisFrameLogInputDTO): Promise<GetAnalysisFrameLogOutputDTO> {
        const analysis = await this.#analysisRepo.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if (analysis.props.team !== input.teamId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        return this.#executionLogService.getFrameLog({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: analysis.props.trajectory,
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
            const analysis = await this.#analysisRepo.findById(analysisId);
            if (!analysis) {
                throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
            }
            if (analysis.props.team !== teamId) {
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
        const analysis = await this.#analysisRepo.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if (input.teamId && analysis.props.team !== input.teamId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        const persisted = toPersistedOutput(analysis);

        return {
            ...persisted,
            plugin: extractPluginId(persisted.plugin)
        };
    }

    async deleteAnalysisById(input: DeleteAnalysisByIdInput): Promise<{ success: boolean }> {
        const analysis = await this.#analysisRepo.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if (input.teamId && analysis.props.team !== input.teamId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Analysis does not belong to this team');
        }

        const deleted = await this.#analysisRepo.deleteById(input.analysisId);

        if (!deleted) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        await this.#eventBus.publish(new AnalysisDeletedEvent({
            analysisId: input.analysisId,
            trajectoryId: analysis.props.trajectory ?? '',
            pluginId: analysis.props.plugin ?? '',
            teamId: analysis.props.team ?? '',
            teamClusterId: resolveAnalysisStorageClusterId(analysis.props),
            storageClusterId: resolveAnalysisStorageClusterId(analysis.props),
            computeClusterId: resolveAnalysisComputeClusterId(analysis.props),
            userId: input.userId ?? '',
            pluginDisplayName: analysis.props.pluginDisplayName
        }));

        return { success: true };
    }
}
