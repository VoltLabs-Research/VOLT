import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import { AnalysisStatus } from '@modules/analysis/contracts/analysis';
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
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import type { Analysis } from '@shared/contracts/types';
import logger from '@shared/infrastructure/logger';
import type {
    ExecutePipelineInput as WireExecutePipelineInput,
    ExecutePipelineStageInput
} from '@volt/contracts/modules/plugin/http';

export type PipelineStageInput = ExecutePipelineStageInput;

export interface ExecutePipelineInput extends WireExecutePipelineInput {
    trajectoryId: string;
    userId: string;
    teamId: string;
}

/**
 * Turns a pipeline request into the ordered stage executions the daemon runs:
 * resolves the trajectory and its compute cluster once, hands every plugin stage
 * to the stage planner, then dispatches the whole pipeline. Any Analysis row the
 * planner created is marked failed if the dispatch itself throws.
 */
export default class PipelineExecutionPlanner {
    #stagePlanner = new PluginStagePlanner();
    #teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    async executePipeline(input: ExecutePipelineInput): Promise<{ analysisIds: string[] }> {
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
            // The relation is either an id or the hydrated frame document.
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

        try {
            for (const stage of input.stages) {
                if (stage.kind !== 'plugin') {
                    upstreamStageHashes.push(computeDumpStageHash(stage.kind, stage.config));
                    stageExecutions.push({
                        kind: stage.kind,
                        config: stage.config
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
                    timestep: input.timestep
                });

                upstreamStageHashes.push(planned.stageHash);
                stageExecutions.push(planned.execution);
                if (planned.createdAnalysis) {
                    createdAnalyses.push(planned.createdAnalysis);
                }
            }

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

        return { analysisIds: createdAnalyses.map((analysis) => analysis._id) };
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
