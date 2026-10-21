import { ErrorCodes } from '@core/constants/error-codes';
import daemonAnalysisCompletionService from '@modules/cluster/services/daemon/DaemonAnalysisCompletionService';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import {
    buildPluginDispatch,
    type RoutePluginExecutionInput
} from '@modules/plugin/services/plugin/plugin-dispatch-payload';
import ApplicationError from '@shared/errors/ApplicationError';
import logger from '@shared/logger';
import type { PipelineStageKind } from '@volt/contracts/modules/plugin/http';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import type { QueuedAnalysisJobNotification } from '@volt/contracts/modules/cluster/daemon-events';
import type {
    PipelineStageTransport,
    PipelineStartTransportRequest,
    TrajectoryFrame
} from '@volt/contracts/modules/analysis/daemon';

export interface PipelineStageExecutionInput {
    kind: PipelineStageKind;
    execution?: RoutePluginExecutionInput;
    cacheHit?: boolean;
    cacheSourceAnalysisId?: string;
    sharedExposureIds?: string[];
    config?: Record<string, unknown>;
}

interface RoutePipelineExecutionInput {
    teamClusterId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    trajectoryFrames: TrajectoryFrame[];
    storageClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageExecutionInput[];
}

interface DaemonPipelineStartResponse {
    jobs: QueuedAnalysisJobNotification[];
}

type ComputingStage = PipelineStageExecutionInput & { execution: RoutePluginExecutionInput };

const groupJobsByAnalysisId = (jobs: QueuedAnalysisJobNotification[]): Map<string, QueuedAnalysisJobNotification[]> => {
    const jobsByAnalysisId = new Map<string, QueuedAnalysisJobNotification[]>();

    for (const job of jobs) {
        const existing = jobsByAnalysisId.get(job.analysisId);
        if (existing) {
            existing.push(job);
        } else {
            jobsByAnalysisId.set(job.analysisId, [job]);
        }
    }

    return jobsByAnalysisId;
};

class PluginExecutionRouter {
    async routePipeline(input: RoutePipelineExecutionInput): Promise<void> {
        const stageDispatches: PipelineStageTransport[] = [];
        const syncTasks: Promise<void>[] = [];

        for (const stage of input.stages) {
            if (stage.kind !== 'plugin') {
                stageDispatches.push({
                    kind: stage.kind,
                    config: stage.config
                });
                continue;
            }

            if (stage.cacheHit) {
                stageDispatches.push({
                    kind: 'plugin',
                    cacheHit: true,
                    cacheSourceAnalysisId: stage.cacheSourceAnalysisId,
                    sharedExposureIds: stage.sharedExposureIds
                });
                continue;
            }

            if (!stage.execution) {
                throw ApplicationError.badRequest(
                    ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                    'Pipeline plugin stage is missing its execution payload'
                );
            }

            const { dispatchPayload, syncTasks: stageSyncTasks } = await buildPluginDispatch(stage.execution);
            syncTasks.push(...stageSyncTasks);
            stageDispatches.push({
                kind: 'plugin',
                plugin: dispatchPayload,
                sharedExposureIds: stage.sharedExposureIds
            });
        }

        await Promise.all(syncTasks);

        const pipelinePayload: PipelineStartTransportRequest = {
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            trajectoryId: input.trajectoryId,
            storageClusterId: input.storageClusterId,
            selectedTimesteps: input.selectedTimesteps,
            timestep: input.timestep,
            stages: stageDispatches
        };

        const response = await teamClusterDaemonClient.command<DaemonPipelineStartResponse>(
            input.teamClusterId,
            DaemonCommand.PipelineStart,
            pipelinePayload
        );

        const computingStages = input.stages.filter(
            (stage): stage is ComputingStage =>
                stage.kind === 'plugin' && !stage.cacheHit && stage.execution !== undefined
        );

        await this.openCompletionSessions(input, computingStages, groupJobsByAnalysisId(response.jobs));
    }

    private async openCompletionSessions(
        input: RoutePipelineExecutionInput,
        computingStages: ComputingStage[],
        jobsByAnalysisId: Map<string, QueuedAnalysisJobNotification[]>
    ): Promise<void> {
        for (const stage of computingStages) {
            const stageJobs = jobsByAnalysisId.get(stage.execution.analysisId) ?? [];
            await daemonAnalysisCompletionService.initializeSession(
                stage.execution.analysisId,
                stageJobs.length,
                input.teamId,
                input.trajectoryId
            );

            if (stageJobs.length === 0) {
                continue;
            }

            await daemonAnalysisCompletionService.handleJobsQueued(
                stageJobs.map((job) => ({
                    ...job,
                    trajectoryName: input.trajectoryName
                })),
                input.teamId,
                input.teamClusterId
            ).catch((error) => {
                logger.warn(error, '@plugin-execution-router: failed to project queued pipeline jobs');
            });
        }
    }
}

export default new PluginExecutionRouter();
