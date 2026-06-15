import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type {
    ITrajectoryRepository,
    IAnalysisRepository,
    ITeamClusterSelectionService,
    ITrajectoryFrameRepository,
    IStoragePlacementService
} from '@shared/contracts/ports';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    ExecutePipelineInputDTO,
    ExecutePipelineOutputDTO,
    PipelineStageInput
} from '@modules/plugin/application/dtos/plugin/ExecutePipelineDTO';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import type { IPluginDependencyResolverService } from '@modules/plugin/domain/port/plugin/IPluginDependencyResolverService';
import type {
    IPluginExecutionRouter,
    PipelineStageExecutionInput,
    RoutePluginExecutionInput
} from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import type { IWorkflowValidatorService } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { sanitizeVisibleArgumentConfig } from '@modules/plugin/utilities/plugin/argument-visibility';
import PluginDisplayNameResolver from '@modules/plugin/utilities/plugin/PluginDisplayNameResolver';
import {
    computeDumpStageHash,
    computePipelineStageHash
} from '@modules/plugin/utilities/plugin/pipeline-stage-hash';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import type { Analysis, AnalysisExpectedArtifact } from '@shared/contracts/types';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

const EXPECTED_ARTIFACT_EXPORTERS = new Set([
    'AtomisticExporter',
    'MeshExporter',
    'LineExporter',
    'ChartExporter'
]);

// Exposures whose node carries an `id` (length >= 1) feed ctx.sharedExposures
// downstream. Collected so a cache-hit stage can still seed the context from a
// reused analysis without re-running the binary.
const collectSharedExposureIds = (plugin: { props: { exposures?: unknown } }): string[] => {
    const exposures = Array.isArray(plugin.props.exposures) ? plugin.props.exposures : [];
    const ids: string[] = [];
    for (const exposure of exposures) {
        const id = (exposure as { id?: unknown }).id;
        if (typeof id === 'string' && id.length >= 1) {
            ids.push(id);
        }
    }
    return ids;
};

const resolveExpectedArtifacts = (pluginId: string, plugin: { props: { exposures?: unknown } }): AnalysisExpectedArtifact[] => {
    const exposures = Array.isArray(plugin.props.exposures) ? plugin.props.exposures : [];

    const artifacts = exposures
        .filter((exposure): exposure is { _id: string; name?: string; export?: { exporter?: string; type?: string } | null } => {
            return typeof exposure === 'object'
                && exposure !== null
                && typeof (exposure as { _id?: unknown })._id === 'string';
        })
        .filter((exposure) => {
            const exporter = exposure.export?.exporter;
            return typeof exporter === 'string' && EXPECTED_ARTIFACT_EXPORTERS.has(exporter);
        })
        .map((exposure): AnalysisExpectedArtifact => ({
            exposureId: exposure._id,
            name: exposure.name || exposure._id,
            pluginId,
            exporter: exposure.export?.exporter,
            exportType: exposure.export?.type,
            status: 'pending'
        }));

    const primaryIndex = artifacts.findIndex((artifact) => artifact.exportType === 'glb');
    const selectedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

    return artifacts.map((artifact, index) => ({
        ...artifact,
        isPrimary: index === selectedPrimaryIndex
    }));
};

@Singleton()
export class ExecutePipelineUseCase implements IUseCase<ExecutePipelineInputDTO, ExecutePipelineOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepo: IPluginRepository,
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepo: IAnalysisRepository,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository,
        @inject(COMPUTE_TOKENS.TrajectoryFrameRepository) private readonly trajectoryFrameRepo: ITrajectoryFrameRepository,
        @inject(PLUGIN_TOKENS.PluginExecutionRouter) private readonly pluginExecutionRouter: IPluginExecutionRouter,
        @inject(PLUGIN_TOKENS.WorkflowValidatorService) private readonly workflowValidator: IWorkflowValidatorService,
        @inject(PLUGIN_TOKENS.PluginDependencyResolverService) private readonly pluginDependencyResolverService: IPluginDependencyResolverService,
        @inject(COMPUTE_TOKENS.StoragePlacementService) private readonly storagePlacementService: IStoragePlacementService
    ) {}

    async execute(input: ExecutePipelineInputDTO): Promise<Result<ExecutePipelineOutputDTO, ApplicationError>> {
        if (input.stages.length === 0) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Pipeline has no stages to execute'
            ));
        }

        const trajectory = await this.trajectoryRepo.findById(input.trajectoryId);
        if (!trajectory) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        const computeClusterId = await this.teamClusterSelectionService.resolveComputeClusterId(
            input.teamId,
            input.teamClusterId,
            storageClusterId
        );

        const trajectoryFrames = await this.trajectoryFrameRepo.getFrames(input.trajectoryId);
        const trajectoryFramePayloads = trajectoryFrames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: (typeof frame.simulationCell === 'string'
                ? frame.simulationCell
                : frame.simulationCell?._id) ?? ''
        }));

        // Walk the stages in order, accumulating the upstream content-hash chain
        // so each plugin stage's hash captures everything that runs before it.
        const upstreamStageHashes: string[] = [];
        const stageExecutions: PipelineStageExecutionInput[] = [];
        const createdAnalyses: Analysis[] = [];
        const analysisIds: string[] = [];

        try {
            for (const stage of input.stages) {
                if (stage.kind !== 'plugin') {
                    // Dump-mutating client stage (slice / expression): no analysis,
                    // just folds into the downstream hash chain + ships its config.
                    upstreamStageHashes.push(computeDumpStageHash(stage.kind, stage.config));
                    stageExecutions.push({ kind: stage.kind, config: stage.config });
                    continue;
                }

                const stageResult = await this.buildPluginStage(
                    stage,
                    input,
                    trajectory.props.name,
                    storageClusterId,
                    computeClusterId,
                    trajectoryFramePayloads,
                    [...upstreamStageHashes]
                );
                if (stageResult.error) {
                    return Result.fail(stageResult.error);
                }

                upstreamStageHashes.push(stageResult.stageHash);
                stageExecutions.push(stageResult.execution);
                if (stageResult.createdAnalysis) {
                    createdAnalyses.push(stageResult.createdAnalysis);
                    analysisIds.push(stageResult.createdAnalysis._id);
                }
            }

            await this.pluginExecutionRouter.routePipeline({
                teamClusterId: computeClusterId,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                trajectoryName: trajectory.props.name,
                trajectoryFrames: trajectoryFramePayloads,
                storageClusterId,
                selectedTimesteps: input.selectedTimesteps,
                timestep: input.timestep,
                stages: stageExecutions
            });
        } catch (error: unknown) {
            // Mark any analyses we created (for compute stages) as failed so they
            // don't hang in `pending` after a dispatch error.
            await Promise.all(createdAnalyses.map((analysis) =>
                this.analysisRepo.updateById(analysis._id, {
                    status: 'failed',
                    finishedAt: new Date()
                }).catch((updateError: unknown) => {
                    logger.warn(
                        { analysisId: analysis._id, err: updateError },
                        '@execute-pipeline-use-case: failed to mark analysis failed after dispatch error'
                    );
                })
            ));
            throw error;
        }

        return Result.ok({ analysisIds });
    }

    private async buildPluginStage(
        stage: PipelineStageInput,
        input: ExecutePipelineInputDTO,
        trajectoryName: string,
        storageClusterId: string | undefined,
        computeClusterId: string,
        trajectoryFramePayloads: Array<{ timestep: number; natoms: number; simulationCell: string }>,
        upstreamStageHashes: string[]
    ): Promise<{
        stageHash: string;
        execution: PipelineStageExecutionInput;
        createdAnalysis?: Analysis;
        error?: ApplicationError;
    }> {
        const fail = (error: ApplicationError) => ({ stageHash: '', execution: { kind: 'plugin' as const }, error });

        if (!stage.pluginId) {
            return fail(ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_FOUND, 'Pipeline plugin stage is missing a pluginId'));
        }

        const plugin = await this.pluginRepo.findById(stage.pluginId);
        if (!plugin) {
            return fail(ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin ${stage.pluginId} not found`));
        }
        if (plugin.props.status !== PluginStatus.Published) {
            return fail(ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin ${stage.pluginId} is not published`));
        }

        const { isValid, errors } = await this.workflowValidator.validate(
            plugin.props.workflow.props,
            plugin.id,
            WorkflowValidationMode.Strict
        );
        if (!isValid) {
            const detail = errors?.length ? `: ${errors.join('; ')}` : '';
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                `Plugin workflow is invalid${detail}`
            ));
        }

        const pluginDisplayName = PluginDisplayNameResolver.resolve(plugin.props.workflow);
        if (!pluginDisplayName) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Modifier node must define a non-empty name'
            ));
        }

        const sanitizedConfig = sanitizeVisibleArgumentConfig(plugin.props.arguments ?? [], stage.config);
        const sharedExposureIds = collectSharedExposureIds(plugin);
        const stageHash = computePipelineStageHash({
            trajectoryId: input.trajectoryId,
            selectedTimesteps: input.selectedTimesteps,
            upstreamStageHashes,
            pluginId: plugin._id,
            config: sanitizedConfig
        });

        // Cache lookup: a previously COMPLETED analysis with the same content
        // hash means this stage's output is already on the cluster — reuse it.
        const cached = await this.analysisRepo.findOne({
            pipelineStageHash: stageHash,
            status: 'completed',
            trajectory: input.trajectoryId
        });
        if (cached) {
            return {
                stageHash,
                execution: {
                    kind: 'plugin',
                    cacheHit: true,
                    cacheSourceAnalysisId: cached._id,
                    sharedExposureIds
                }
            };
        }

        // Cache miss: resolve dependencies and create the analysis. Cross-plugin
        // CHAINING is gone in the pipeline model, but argument-level plugin
        // references survive for MultiSOM (its feature providers are a real
        // user-facing feature, not a hidden dependency — see the rebuild plan).
        // We therefore resolve the argument references from this stage's config
        // and fold the referenced plugins (plus their transitive deps) into the
        // dependency set, so the router ships them as nestedPlugins + the daemon
        // can run the nested provider workflows. A plugin with no pluginReference
        // arguments (every plugin except MultiSOM today) yields an empty set here.
        const referenceValidation = await this.pluginDependencyResolverService.validateArgumentPluginReferenceExecutions(
            plugin,
            sanitizedConfig
        );
        if (referenceValidation.errors.length) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                referenceValidation.errors.join('; ')
            ));
        }

        const dependencyResolution = await this.pluginDependencyResolverService.collectTransitivePublishedDependencies(plugin);
        if (dependencyResolution.errors.length) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                dependencyResolution.errors.join('; ')
            ));
        }

        const referencedPluginDependencies = await this.pluginDependencyResolverService.collectTransitivePublishedDependenciesForPlugins(
            referenceValidation.plugins
        );
        if (referencedPluginDependencies.errors.length) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                referencedPluginDependencies.errors.join('; ')
            ));
        }

        // nestedPlugins (built by the router from pluginDependencies) must contain
        // the declared deps, the referenced provider plugins themselves, AND those
        // providers' transitive deps — deduped by id. Mirror the debug path.
        const pluginDependencies = Array.from(new Map(
            [
                ...dependencyResolution.dependencies,
                ...referenceValidation.plugins,
                ...referencedPluginDependencies.dependencies
            ].map((candidate) => [candidate.id, candidate])
        ).values());

        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        if (entrypointNode?.data.entrypoint?.binaryObjectPath) {
            await this.storagePlacementService.ensurePlacement('plugin-binary', plugin.id);
        }

        const analysis = await this.analysisRepo.create({
            plugin: plugin._id,
            pluginDisplayName,
            computeClusterId,
            storageClusterId,
            config: sanitizedConfig,
            pipelineStageHash: stageHash,
            team: input.teamId,
            trajectory: input.trajectoryId,
            createdBy: input.userId,
            startedAt: new Date(),
            artifactStatus: 'pending',
            expectedArtifacts: resolveExpectedArtifacts(plugin._id, plugin),
            stages: [],
            childAnalyses: []
        });
        await this.storagePlacementService.ensurePlacement('analysis', analysis._id);

        const execution: RoutePluginExecutionInput = {
            teamClusterId: computeClusterId,
            analysis,
            analysisId: analysis._id,
            pluginDisplayName,
            trajectoryId: input.trajectoryId,
            trajectoryName,
            trajectoryFrames: trajectoryFramePayloads,
            teamId: input.teamId,
            plugin,
            pluginDependencies,
            pluginReferenceExecutions: referenceValidation.executions,
            config: sanitizedConfig,
            selectedTimesteps: input.selectedTimesteps,
            timestep: input.timestep
        };

        return {
            stageHash,
            execution: { kind: 'plugin', execution, sharedExposureIds },
            createdAnalysis: analysis
        };
    }
}
