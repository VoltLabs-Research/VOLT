import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { injectable, inject } from 'tsyringe';
import { ExecutePluginInputDTO } from '@modules/plugin/application/dtos/plugin/ExecutePluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { ErrorCodes } from '@core/constants/error-codes';
import { IPluginWorkflowEngine } from '@modules/plugin/domain/port/IPluginWorkflowEngine';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import AnalysisCreatedEvent from '@modules/analysis/domain/events/AnalysisCreatedEvent';
import { IAnalysisJobFactory } from '@modules/plugin/domain/port/IAnalysisJobFactory';
import type { IAnalysisQueue } from '@modules/plugin/domain/port/IAnalysisQueue';
import PluginDisplayNameResolver from '@modules/plugin/domain/services/PluginDisplayNameResolver';

@injectable()
export class ExecutePluginUseCase implements IUseCase<ExecutePluginInputDTO, { analysisId: string }, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,

        @inject(PLUGIN_TOKENS.PluginWorkflowEngine)
        private workflowEngine: IPluginWorkflowEngine,

        @inject(SHARED_TOKENS.EventBus)
        private eventBus: IEventBus,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository,

        @inject(PLUGIN_TOKENS.AnalysisJobFactory)
        private jobFactory: IAnalysisJobFactory,

        @inject(PLUGIN_TOKENS.AnalysisProcessingQueue)
        private analysisQueue: IAnalysisQueue
    ){}

    async execute(input: ExecutePluginInputDTO): Promise<Result<{ analysisId: string }, ApplicationError>> {
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

        if (!plugin.props.validated) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Plugin not validated'
            ));
        }

        if (!trajectory) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            ));
        }

        const pluginDisplayName = PluginDisplayNameResolver.resolve(plugin.props.workflow);

        if (!pluginDisplayName) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Modifier node must define a non-empty name'
            ));
        }

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

            config: input.config,
            team: input.teamId,
            trajectory: input.trajectoryId,
            createdBy: input.userId,
            startedAt: new Date()
        });

        await this.eventBus.publish(new AnalysisCreatedEvent({
            analysisId: analysis.id,
            trajectoryId: input.trajectoryId,
            pluginId: plugin._id,
            pluginDisplayName,
            teamId: input.teamId,
            config: input.config,
            status: 'pending',
            createdAt: new Date()
        }));

        const planResult = await this.workflowEngine.planExecutionStrategy({
            plugin,
            trajectoryId: input.trajectoryId,
            analysisId: analysis.id,
            userConfig: input.config,
            teamId: input.teamId,
            options: {
                selectedFrameOnly: input.selectedFrameOnly,
                timestep: input.timestep
            }
        });

        if (!planResult || planResult.items.length === 0) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'No items after ForEach node evaluation'
            ));
        }

        // Create jobs from the ForEach items
        const jobs = this.jobFactory.create({
            analysisId: analysis.id,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            trajectoryName: trajectory.props.name,
            plugin,
            items: planResult.items,
            config: input.config
        });

        // Update analysis with total frames count
        await this.analysisRepo.updateById(analysis.id, {
            totalFrames: jobs.length
        });

        // Add jobs to the analysis queue for processing
        await this.analysisQueue.addJobs(jobs);

        return Result.ok({ analysisId: analysis.id });
    }
};
