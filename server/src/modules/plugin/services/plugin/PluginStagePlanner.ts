import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import { AnalysisArtifactStatus, AnalysisStatus } from '@modules/analysis/contracts/analysis';
import { toAnalysisLike } from '@modules/analysis/services/AnalysisQueries';
import { requirePlugin } from '@modules/plugin/services/plugin/PluginQueries';
import { sanitizeVisibleArgumentConfig } from '@modules/plugin/services/plugin/ArgumentVisibility';
import { PluginDependencyResolverService } from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import type {
    PipelineStageExecutionInput,
    RoutePluginExecutionInput,
    TrajectoryFramePayload
} from '@modules/plugin/services/plugin/PluginExecutionRouter';
import { resolveExpectedArtifacts } from '@modules/plugin/services/plugin/expected-analysis-artifacts';
import {
    cannotExecute,
    resolveExecutionClosure
} from '@modules/plugin/services/plugin/plugin-execution-closure';
import {
    resolvePluginDisplayName,
    computePipelineStageHash
} from '@modules/plugin/services/plugin/WorkflowProjection';
import {
    WorkflowValidationMode,
    WorkflowValidatorService
} from '@modules/plugin/services/plugin/WorkflowValidatorService';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IStoragePlacementService } from '@shared/contracts/ports';
import type { Analysis } from '@shared/contracts/types';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type { ExecutePipelineStageInput } from '@volt/contracts/modules/plugin/http';

export interface PlannedStage {
    stageHash: string;
    execution: PipelineStageExecutionInput;
    createdAnalysis?: Analysis;
}

export interface PlanPluginStageParams {
    stage: ExecutePipelineStageInput;
    userId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    trajectoryFrames: TrajectoryFramePayload[];
    storageClusterId?: string;
    computeClusterId: string;
    upstreamStageHashes: string[];
    selectedTimesteps: number[];
    timestep?: number;
}

const ANALYSIS_EXECUTION_METADATA_KEY = '__voltExecution';

/**
 * Turns one plugin stage of a pipeline request into the execution the daemon
 * runs: validates the plugin, resolves its dependency closure, reuses a cached
 * stage when its hash already completed, and creates the Analysis row otherwise.
 */
export default class PluginStagePlanner {
    #dependencyResolver = new PluginDependencyResolverService();
    #workflowValidator = new WorkflowValidatorService(this.#dependencyResolver);
    #storagePlacementService: IStoragePlacementService = storagePlacementService;

    async planPluginStage({
        stage,
        userId,
        teamId,
        trajectoryId,
        trajectoryName,
        trajectoryFrames,
        storageClusterId,
        computeClusterId,
        upstreamStageHashes,
        selectedTimesteps,
        timestep
    }: PlanPluginStageParams): Promise<PlannedStage> {
        if (!stage.pluginId) {
            throw ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_FOUND, 'Pipeline plugin stage is missing a pluginId');
        }

        const plugin = await requirePlugin(stage.pluginId);
        if (plugin.props.status !== PluginStatus.PUBLISHED) {
            throw ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin ${stage.pluginId} is not published`);
        }

        const { isValid, errors } = await this.#workflowValidator.validate(
            plugin.props.workflow.props,
            plugin.id,
            WorkflowValidationMode.Strict
        );
        if (!isValid) {
            const detail = errors?.length ? `: ${errors.join('; ')}` : '';
            throw cannotExecute(`Plugin workflow is invalid${detail}`);
        }

        const pluginDisplayName = resolvePluginDisplayName(plugin.props.workflow);
        if (!pluginDisplayName) {
            throw cannotExecute('Modifier node must define a non-empty name');
        }

        const config = sanitizeVisibleArgumentConfig(plugin.props.arguments ?? [], stage.config);
        const sharedExposureIds = (plugin.props.exposures ?? [])
            .map((exposure) => exposure.id)
            .filter((exposureId): exposureId is string => Boolean(exposureId));
        const stageHash = computePipelineStageHash({
            trajectoryId,
            selectedTimesteps,
            upstreamStageHashes,
            pluginId: plugin._id,
            config
        });

        const cached = await AnalysisEntity.findOneBy({
            pipelineStageHash: stageHash,
            status: AnalysisStatus.Completed,
            trajectory: trajectoryId
        });
        if (cached) {
            return {
                stageHash,
                execution: {
                    kind: 'plugin',
                    cacheHit: true,
                    cacheSourceAnalysisId: cached.id,
                    sharedExposureIds
                }
            };
        }

        const closure = await resolveExecutionClosure(this.#dependencyResolver, plugin, config);

        if (plugin.props.workflow.entrypoint?.binaryObjectPath) {
            await this.#storagePlacementService.ensurePlacement('plugin-binary', plugin.id);
        }

        const analysisEntity = await AnalysisEntity.create({
            plugin: plugin._id,
            pluginDisplayName,
            computeClusterId,
            storageClusterId,
            config: {
                ...config,
                [ANALYSIS_EXECUTION_METADATA_KEY]: { selectedTimesteps }
            },
            pipelineStageHash: stageHash,
            team: teamId,
            trajectory: trajectoryId,
            createdBy: userId,
            startedAt: new Date(),
            artifactStatus: AnalysisArtifactStatus.Pending,
            expectedArtifacts: resolveExpectedArtifacts(plugin),
            stages: [],
            childAnalyses: []
        }).save();
        await this.#storagePlacementService.ensurePlacement('analysis', analysisEntity.id);
        const analysis = toAnalysisLike(analysisEntity);

        const execution: RoutePluginExecutionInput = {
            teamClusterId: computeClusterId,
            analysis,
            analysisId: analysis._id,
            pluginDisplayName,
            trajectoryId,
            trajectoryName,
            trajectoryFrames,
            teamId,
            plugin,
            pluginDependencies: closure.plugins,
            pluginReferenceExecutions: closure.executions,
            config,
            selectedTimesteps,
            timestep
        };

        return {
            stageHash,
            execution: {
                kind: 'plugin',
                execution,
                sharedExposureIds
            },
            createdAnalysis: analysis
        };
    }
}
