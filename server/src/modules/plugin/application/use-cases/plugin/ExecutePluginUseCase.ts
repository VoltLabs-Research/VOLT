import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { ExecutePluginInputDTO } from '@modules/plugin/application/dtos/plugin/ExecutePluginDTO';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { IPluginExecutionRouter } from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { IWorkflowValidatorService, WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import PluginDisplayNameResolver from '@modules/plugin/utilities/plugin/PluginDisplayNameResolver';
import { sanitizeVisibleArgumentConfig } from '@modules/plugin/utilities/plugin/argument-visibility';
import { PluginDependencyResolverService } from '@modules/plugin/infrastructure/services/plugin/PluginDependencyResolverService';

import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import AnalysisCreatedEvent from '@modules/analysis/domain/events/AnalysisCreatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { ArgumentDefinition } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import type { WorkflowNode } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';

interface ExecutePluginOutputDTO {
    analysisId: string;
};

interface TrajectoryFrameReference {
    timestep: number;
};

interface AnalysisExecutionMetadata {
    selectedTimesteps?: number[];
};

const ANALYSIS_EXECUTION_METADATA_KEY = '__voltExecution';
const SELECTED_TIMESTEPS_RUNTIME_ARGUMENT_KEY = 'selectedTimesteps';

const hasArgumentDefinition = (definitions: ArgumentDefinition[], argumentKey: string): boolean => {
    return definitions.some((definition) => {
        if (definition.argument === argumentKey) {
            return true;
        }

        return definition.listArguments
            ? hasArgumentDefinition(definition.listArguments, argumentKey)
            : false;
    });
};

const hasPersistedArgumentCollision = (nodes: WorkflowNode[], argumentKey: string): boolean => {
    const argumentsNode = nodes.find((node) => node.type === 'arguments');
    const definitions = argumentsNode?.data.arguments?.arguments ?? [];

    return hasArgumentDefinition(definitions, argumentKey);
};

const sanitizeSelectedTimesteps = (
    selectedTimesteps: number[] | undefined,
    trajectoryFrames: TrajectoryFrameReference[]
): number[] | undefined => {
    if (!selectedTimesteps?.length || !trajectoryFrames.length) {
        return undefined;
    }

    const availableTimesteps = new Set(trajectoryFrames.map((frame) => frame.timestep));
    const sanitizedTimesteps = Array.from(new Set(
        selectedTimesteps.filter((timestep) => availableTimesteps.has(timestep))
    )).sort((left, right) => left - right);

    if (!sanitizedTimesteps.length || sanitizedTimesteps.length === availableTimesteps.size) {
        return undefined;
    }

    return sanitizedTimesteps;
};

const createAnalysisConfig = (
    config: Record<string, unknown>,
    selectedTimesteps: number[] | undefined,
    shouldInjectRuntimeMetadata: boolean
): Record<string, unknown> => {
    if (!shouldInjectRuntimeMetadata) {
        return { ...config };
    }

    const sanitizedConfig = { ...config };
    delete sanitizedConfig[SELECTED_TIMESTEPS_RUNTIME_ARGUMENT_KEY];

    if (!selectedTimesteps?.length) {
        return sanitizedConfig;
    }

    const metadata: AnalysisExecutionMetadata = {
        selectedTimesteps
    };

    return {
        ...sanitizedConfig,
        [ANALYSIS_EXECUTION_METADATA_KEY]: metadata
    };
};

@injectable()
export class ExecutePluginUseCase implements IUseCase<ExecutePluginInputDTO, ExecutePluginOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,

        @inject(SHARED_TOKENS.EventBus)
        private eventBus: IEventBus,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository,

        @inject(PLUGIN_TOKENS.PluginExecutionRouter)
        private readonly pluginExecutionRouter: IPluginExecutionRouter,

        @inject(PLUGIN_TOKENS.WorkflowValidatorService)
        private readonly workflowValidator: IWorkflowValidatorService,

        @inject(PLUGIN_TOKENS.PluginDependencyResolverService)
        private readonly pluginDependencyResolverService: PluginDependencyResolverService,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementService)
        private readonly storagePlacementService: StoragePlacementService
    ){}

    async execute(input: ExecutePluginInputDTO): Promise<Result<ExecutePluginOutputDTO, ApplicationError>> {
        const [trajectory, plugin] = await Promise.all([
            this.trajectoryRepo.findById(input.trajectoryId),
            this.pluginRepo.findById(input.pluginId)
        ]);

        if (plugin && plugin.props.status !== PluginStatus.Published) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin is not published'
            ));
        }
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const { isValid, errors: validationErrors } = await this.workflowValidator.validate(
            plugin.props.workflow.props,
            plugin.id,
            WorkflowValidationMode.Strict
        );
        if (!isValid) {
            const detail = validationErrors?.length
                ? `: ${validationErrors.join('; ')}`
                : '';
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                `Plugin workflow is invalid${detail}`
            ));
        }

        if (!trajectory) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        const binaryObjectPath = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if (binaryObjectPath) {
            await this.storagePlacementService.ensurePlacement('plugin-binary', plugin.id);
        }

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        const computeClusterId = await this.teamClusterSelectionService.resolveComputeClusterId(
            input.teamId,
            input.teamClusterId,
            storageClusterId
        );

        const pluginDisplayName = PluginDisplayNameResolver.resolve(plugin.props.workflow);

        if (!pluginDisplayName) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Modifier node must define a non-empty name'
            ));
        }

        const selectedTimesteps = sanitizeSelectedTimesteps(input.selectedTimesteps, trajectory.props.frames);
        const hasSelectedTimestepsCollision = hasPersistedArgumentCollision(
            plugin.props.workflow.props.nodes,
            SELECTED_TIMESTEPS_RUNTIME_ARGUMENT_KEY
        );
        const argumentDefinitions = plugin.props.arguments ?? [];
        const sanitizedUserConfig = sanitizeVisibleArgumentConfig(argumentDefinitions, input.config);
        const analysisConfig = createAnalysisConfig(
            sanitizedUserConfig,
            selectedTimesteps,
            !hasSelectedTimestepsCollision
        );
        const pluginReferenceExecutions = this.pluginDependencyResolverService.getArgumentPluginReferenceExecutions(
            plugin,
            analysisConfig
        );
        const dependencyResolution = await this.pluginDependencyResolverService.collectTransitivePublishedDependencies(plugin);
        if (dependencyResolution.errors.length) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                dependencyResolution.errors.join('; ')
            ));
        }
        const runtimePluginIds = Array.from(new Set(pluginReferenceExecutions.map((reference) => reference.pluginId)));
        const runtimePlugins = runtimePluginIds.length > 0
            ? await this.pluginRepo.findByIds(runtimePluginIds)
            : [];
        const runtimeDependencyResolution = await this.pluginDependencyResolverService.collectTransitivePublishedDependenciesForPlugins(
            runtimePlugins
        );
        if (runtimeDependencyResolution.errors.length > 0) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                runtimeDependencyResolution.errors.join('; ')
            ));
        }
        const allDependencies = Array.from(new Map(
            [
                ...dependencyResolution.dependencies,
                ...runtimePlugins,
                ...runtimeDependencyResolution.dependencies
            ].map((candidate) => [candidate.id, candidate])
        ).values());

        await this.eventBus.publish(new PluginExecutionRequestEvent({
            pluginId: plugin._id,
            trajectoryId: input.trajectoryId,
            userId: input.userId,
            pluginName: pluginDisplayName,
            teamId: input.teamId,
            trajectoryName: trajectory.props.name
        }));

        const analysis = await this.analysisRepo.create({
            plugin: plugin._id,
            pluginDisplayName,
            computeClusterId,
            storageClusterId,
            config: analysisConfig,
            team: input.teamId,
            trajectory: input.trajectoryId,
            createdBy: input.userId,
            startedAt: new Date()
        });

        try {
            await this.storagePlacementService.ensurePlacement('analysis', analysis.id);

            await this.eventBus.publish(new AnalysisCreatedEvent({
                analysisId: analysis.id,
                trajectoryId: input.trajectoryId,
                pluginId: plugin._id,
                pluginDisplayName,
                teamId: input.teamId,
                config: analysisConfig,
                status: 'pending',
                createdAt: new Date()
            }));

            await this.pluginExecutionRouter.route({
                teamClusterId: computeClusterId,
                analysis,
                analysisId: analysis.id,
                pluginDisplayName,
                trajectoryId: input.trajectoryId,
                trajectoryName: trajectory.props.name,
                trajectoryFrames: trajectory.props.frames,
                teamId: input.teamId,
                plugin,
                pluginDependencies: allDependencies,
                pluginReferenceExecutions,
                config: analysisConfig,
                selectedFrameOnly: input.selectedFrameOnly,
                selectedTimesteps,
                timestep: input.timestep
            });
        } catch (error: unknown) {
            await this.analysisRepo.updateById(analysis.id, {
                status: 'failed',
                finishedAt: new Date()
            }).catch((updateError: unknown) => {
                logger.warn(
                    {
                        analysisId: analysis.id,
                        err: updateError
                    },
                    '@execute-plugin-use-case: failed to mark analysis as failed after dispatch error'
                );
            });
            throw error;
        }

        return Result.ok({ analysisId: analysis.id });
    }
};
