import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import { AnalysisStatus } from '@modules/analysis/contracts/analysis';
import PipelineRunEntity from '@modules/plugin/models/PipelineRun';
import pluginExecutionRouter, {
    type PipelineStageExecutionInput
} from '@modules/plugin/services/plugin/PluginExecutionRouter';
import pluginStagePlanner from '@modules/plugin/services/plugin/PluginStagePlanner';
import { cannotExecute } from '@modules/plugin/services/plugin/plugin-execution-closure';
import { computeDumpStageHash } from '@modules/plugin/services/plugin/WorkflowProjection';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import { getTrajectoryFrames, toFlatTrajectoryFrame } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import teamClusterSelectionService from '@modules/cluster/services/team-cluster/TeamClusterSelectionService';
import ApplicationError from '@shared/errors/ApplicationError';
import type { Analysis } from '@shared/contracts/types/AnalysisProps';
import { generateEntityId } from '@shared/persistence/entity-id';
import logger from '@shared/logger';
import type { ExecutePipelineInput as WireExecutePipelineInput, ExecutePipelineStageInput } from '@volt/contracts/modules/plugin/http';
import type { PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';
import type { ExecutePipelineResponse } from '@volt/contracts/modules/plugin/plugin';


export interface ExecutePipelineInput extends WireExecutePipelineInput {
    trajectoryId: string;
    userId: string;
    teamId: string;
}

const toStageInput = (stage: PipelineRunStage): ExecutePipelineStageInput => ({
    kind: stage.kind,
    ...(stage.pluginId ? { pluginId: stage.pluginId } : {}),
    config: stage.config
});

const savedStageAnalysisId = (stage: PipelineRunStage): string | undefined =>
    stage.cacheHit ? stage.cachedFromAnalysisId : stage.analysisId;

class PipelineExecutionPlanner {
    async executePipeline(input: ExecutePipelineInput): Promise<ExecutePipelineResponse> {
        if (input.stages.length === 0) {
            throw cannotExecute('Pipeline has no stages to execute');
        }

        const trajectory = await TrajectoryEntity.findOneBy({ id: input.trajectoryId });
        if (!trajectory) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const extendedRun = input.pipelineRunId ? await this.#loadExtendableRun(input) : null;
        const savedStages = extendedRun ? [...extendedRun.stages].sort((left, right) => left.index - right.index) : [];

        const storageClusterId = trajectory.storageClusterId;
        const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(
            input.teamId,
            input.teamClusterId ?? extendedRun?.computeClusterId ?? undefined,
            storageClusterId
        );

        const trajectoryFrames = await getTrajectoryFrames(input.trajectoryId);
        const trajectoryFramePayloads = trajectoryFrames.map(toFlatTrajectoryFrame);

        // An extended run keeps its own timesteps: they are part of every stage hash, so the saved
        // stages only resolve to their results on the same set.
        const selectedTimesteps = extendedRun?.selectedTimesteps.length
            ? extendedRun.selectedTimesteps
            : input.selectedTimesteps?.length
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
        const pipelineRunId = extendedRun?.id ?? generateEntityId();
        const stages = [...savedStages.map(toStageInput), ...input.stages];

        try {
            for (const [stageIndex, stage] of stages.entries()) {
                // The saved stages are planned again only to feed hashes and inputs downstream; the run
                // keeps their records as they are.
                const isSaved = stageIndex < savedStages.length;

                if (stage.kind !== 'plugin') {
                    upstreamStageHashes.push(computeDumpStageHash(stage.kind, stage.config));
                    stageExecutions.push({
                        kind: stage.kind,
                        config: stage.config
                    });
                    if (isSaved) continue;
                    runStages.push({
                        index: stageIndex,
                        kind: stage.kind,
                        config: stage.config,
                        cacheHit: false
                    });
                    continue;
                }

                const planned = await pluginStagePlanner.planPluginStage({
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

                if (planned.createdAnalysis) {
                    createdAnalyses.push(planned.createdAnalysis);
                }
                if (isSaved && !planned.cacheHit) {
                    throw cannotExecute('This pipeline changed since it ran (a plugin was updated or a result was removed). Duplicate it into the draft and run it again.');
                }

                upstreamStageHashes.push(planned.stageHash);
                stageExecutions.push(planned.execution);
                if (isSaved) continue;
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
            }

            if (extendedRun) {
                extendedRun.stages = [...savedStages, ...runStages];
                await extendedRun.save();
            } else {
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

        // For an extended run these are only the stages it gained.
        return {
            runId: pipelineRunId,
            stages: runStages
        };
    }

    async #loadExtendableRun(input: ExecutePipelineInput): Promise<PipelineRunEntity> {
        const run = await PipelineRunEntity.findOneBy({
            id: input.pipelineRunId,
            team: input.teamId,
            trajectory: input.trajectoryId
        });

        if (!run) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Pipeline run not found');
        }

        // A stage still computing has no result for the new stages to build on yet.
        const analysisIds = run.stages
            .filter((stage) => stage.kind === 'plugin')
            .map(savedStageAnalysisId)
            .filter((analysisId): analysisId is string => Boolean(analysisId));
        const analyses = await Promise.all(analysisIds.map((id) => AnalysisEntity.findOneBy({ id })));
        if (analyses.some((analysis) => analysis?.status !== AnalysisStatus.Completed)) {
            throw cannotExecute('Wait for this pipeline to finish before adding stages to it.');
        }

        return run;
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

export default new PipelineExecutionPlanner();
