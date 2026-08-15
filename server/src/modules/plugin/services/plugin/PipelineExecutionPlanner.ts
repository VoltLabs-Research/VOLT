import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import { AnalysisStatus } from '@modules/analysis/contracts/analysis';
import PipelineRunEntity from '@modules/plugin/models/PipelineRun';
import pluginExecutionRouter, {
    type PipelineStageExecutionInput
} from '@modules/plugin/services/plugin/PluginExecutionRouter';
import PluginStagePlanner from '@modules/plugin/services/plugin/PluginStagePlanner';
import { cannotExecute } from '@modules/plugin/services/plugin/plugin-execution-closure';
import { computeDumpStageHash } from '@modules/plugin/services/plugin/WorkflowProjection';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import { getTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
import type { Analysis } from '@shared/contracts/types/AnalysisProps';
import { generateEntityId } from '@shared/infrastructure/persistence/entity-id';
import logger from '@shared/infrastructure/logger';
import type {
    ExecutePipelineInput as WireExecutePipelineInput,
    ExecutePipelineStageInput
} from '@volt/contracts/modules/plugin/http';
import type { PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';
import type { ExecutePipelineResponse } from '@volt/contracts/modules/plugin/plugin';

export type PipelineStageInput = ExecutePipelineStageInput;

export interface ExecutePipelineInput extends WireExecutePipelineInput {
    trajectoryId: string;
    userId: string;
    teamId: string;
}

export default class PipelineExecutionPlanner {
    #stagePlanner = new PluginStagePlanner();
    #teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    async executePipeline(input: ExecutePipelineInput): Promise<ExecutePipelineResponse> {
        if (input.stages.length === 0) {
            throw cannotExecute('Pipeline has no stages to execute');
        }

        const trajectory = await TrajectoryEntity.findOneBy({ id: input.trajectoryId });
        if (!trajectory) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const storageClusterId = trajectory.storageClusterId;
        const computeClusterId = await this.#teamClusterSelectionService.resolveComputeClusterId(
            input.teamId,
            input.teamClusterId,
            storageClusterId
        );

        const trajectoryFrames = await getTrajectoryFrames(input.trajectoryId);
        const trajectoryFramePayloads = trajectoryFrames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: (typeof frame.simulationCell === 'string'
                ? frame.simulationCell
                : frame.simulationCell?._id) ?? ''
        }));

        const selectedTimesteps = input.selectedTimesteps?.length
            ? input.selectedTimesteps
            : trajectoryFramePayloads.map((frame) => frame.timestep);

        if (selectedTimesteps.length === 0) {
            throw ApplicationError.unprocessableEntity(
                ErrorCodes.TRAJECTORY_DATA_PARSE_FAILED,
                'This trajectory has no frames to run the pipeline on. Wait for trajectory processing to finish, or re-upload a valid trajectory.'
            );
        }

        const upstreamStageHashes: string[] = [];
        const stageExecutions: PipelineStageExecutionInput[] = [];
        const createdAnalyses: Analysis[] = [];
        const runStages: PipelineRunStage[] = [];
        const pipelineRunId = generateEntityId();

        try {
            for (const [stageIndex, stage] of input.stages.entries()) {
                if (stage.kind !== 'plugin') {
                    upstreamStageHashes.push(computeDumpStageHash(stage.kind, stage.config));
                    stageExecutions.push({
                        kind: stage.kind,
                        config: stage.config
                    });
                    runStages.push({
                        index: stageIndex,
                        kind: stage.kind,
                        config: stage.config,
                        cacheHit: false
                    });
                    continue;
                }

                const planned = await this.#stagePlanner.planPluginStage({
                    stage,
                    userId: input.userId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    trajectoryName: trajectory.name,
                    trajectoryFrames: trajectoryFramePayloads,
                    storageClusterId,
                    computeClusterId,
                    upstreamStageHashes: [...upstreamStageHashes],
                    selectedTimesteps,
                    timestep: input.timestep,
                    pipelineRunId,
                    stageIndex
                });

                upstreamStageHashes.push(planned.stageHash);
                stageExecutions.push(planned.execution);
                runStages.push({
                    index: stageIndex,
                    kind: 'plugin',
                    pluginId: stage.pluginId,
                    pluginDisplayName: planned.pluginDisplayName,
                    config: planned.config,
                    cacheHit: planned.cacheHit,
                    ...(planned.cacheHit
                        ? { cachedFromAnalysisId: planned.analysisId }
                        : { analysisId: planned.analysisId })
                });
                if (planned.createdAnalysis) {
                    createdAnalyses.push(planned.createdAnalysis);
                }
            }

            await PipelineRunEntity.create({
                id: pipelineRunId,
                trajectory: input.trajectoryId,
                team: input.teamId,
                createdBy: input.userId,
                computeClusterId,
                storageClusterId: storageClusterId ?? null,
                selectedTimesteps,
                stages: runStages
            }).save();

            await pluginExecutionRouter.routePipeline({
                teamClusterId: computeClusterId,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                trajectoryName: trajectory.name,
                trajectoryFrames: trajectoryFramePayloads,
                storageClusterId,
                selectedTimesteps,
                timestep: input.timestep,
                stages: stageExecutions
            });
        } catch (error: unknown) {
            await this.#markAnalysesFailed(createdAnalyses);
            throw error;
        }

        return {
            runId: pipelineRunId,
            stages: runStages
        };
    }

    async #markAnalysesFailed(analyses: Analysis[]): Promise<void> {
        await Promise.all(analyses.map((analysis) =>
            AnalysisEntity.update(analysis._id, {
                status: AnalysisStatus.Failed,
                finishedAt: new Date()
            }).catch((updateError: unknown) => {
                logger.warn(
                    {
                        analysisId: analysis._id,
                        err: updateError
                    },
                    '@pipeline-execution-planner: failed to mark analysis failed after dispatch error'
                );
            })
        ));
    }
}
