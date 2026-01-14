import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { PLUGIN_TOKENS } from "../../../infrastructure/di/PluginTokens";
import { injectable, inject } from 'tsyringe';
import { ExecutePluginInputDTO } from "../../dtos/plugin/ExecutePluginDTO";
import { IPluginRepository } from "../../../domain/ports/IPluginRepository";
import { PluginStatus } from "../../../domain/entities/Plugin";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { IPluginWorkflowEngine } from "../../../domain/ports/IPluginWorkflowEngine";

@injectable()
export default class ExecutePluginUseCase implements IUseCase<ExecutePluginInputDTO, null, ApplicationError>{
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,

        @inject(PLUGIN_TOKENS.PluginWorkflowEngine)
        private workflowEngine: IPluginWorkflowEngine
    ){}

    async execute(input: ExecutePluginInputDTO): Promise<Result<null, ApplicationError>>{
        const plugin = await this.pluginRepo.findOne({
            slug: input.pluginSlug,
            status: PluginStatus.Published
        });

        if(!plugin){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        if(!plugin.props.validated){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Plugin not validated'
            ));
        }
    }
};