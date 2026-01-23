import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { injectable, inject } from 'tsyringe';
import { ExecutePluginInputDTO } from '@modules/plugin/application/dtos/plugin/ExecutePluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { ErrorCodes } from '@core/constants/error-codes';
import { IPluginWorkflowEngine } from '@modules/plugin/domain/ports/IPluginWorkflowEngine';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import PluginExecutionRequestEvent from '@modules/plugin/domain/events/PluginExecutionRequestEvent';
import { IAnalysisJobFactory } from '@modules/plugin/domain/ports/IAnalysisJobFactory';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';

@injectable()
export class ExecutePluginUseCase implements IUseCase<ExecutePluginInputDTO, null, ApplicationError> {
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
        private analysisQueue: BaseProcessingQueue
    ){}

    async execute(input: ExecutePluginInputDTO): Promise<Result<null, ApplicationError>> {
        const [trajectory, plugin] = await Promise.all([
            this.trajectoryRepo.findById(input.trajectoryId),
            this.pluginRepo.findOne({
                slug: input.pluginSlug,
                status: PluginStatus.Published
            })
        ]);

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

        await this.eventBus.publish(new PluginExecutionRequestEvent(
            plugin.id,
            input.trajectoryId,
            input.userId,
            plugin.props.slug,
            input.teamId,
            trajectory.props.name
        ));

        const analysis = await this.analysisRepo.create({
            plugin: plugin.id,
            config: input.config,
            team: input.teamId,
            trajectory: input.trajectoryId,
            createdBy: input.userId,
            startedAt: new Date()
        });

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

        return Result.ok(null);
    }
};