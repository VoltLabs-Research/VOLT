import { Result } from "@/src/shared/domain/ports/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { PLUGIN_TOKENS } from "../../../infrastructure/di/PluginTokens";
import { injectable, inject } from 'tsyringe';
import { ExecutePluginInputDTO } from "../../dtos/plugin/ExecutePluginDTO";
import { IPluginRepository } from "../../../domain/ports/IPluginRepository";
import { PluginStatus } from "../../../domain/entities/Plugin";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { IPluginWorkflowEngine } from "../../../domain/ports/IPluginWorkflowEngine";
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";
import { IEventBus } from "@/src/shared/application/events/IEventBus";
import { ANALYSIS_TOKENS } from "@/src/modules/analysis/infrastructure/di/AnalysisTokens";
import { IAnalysisRepository } from "@/src/modules/analysis/domain/port/IAnalysisRepository";
import { TRAJECTORY_TOKENS } from "@/src/modules/trajectory/infrastructure/di/TrajectoryTokens";
import { ITrajectoryRepository } from "@/src/modules/trajectory/domain/port/ITrajectoryRepository";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import PluginExecutionRequestEvent from "../../../domain/events/PluginExecutionRequestEvent";

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
        private trajectoryRepo: ITrajectoryRepository
    ) { }

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

        return Result.ok(null);
    }
};