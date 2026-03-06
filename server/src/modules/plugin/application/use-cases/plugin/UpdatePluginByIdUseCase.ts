import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/UpdatePluginByIdDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PluginProps, PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { ErrorCodes } from '@core/constants/error-codes';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IWorkflowValidatorService } from '@modules/plugin/domain/port/IWorkflowValidatorService';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import ApplicationError from '@shared/application/errors/ApplicationErrors';


@injectable()
export class UpdatePluginByIdUseCase implements IUseCase<UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepository: IPluginRepository,

        @inject(PLUGIN_TOKENS.WorkflowValidatorService)
        private workflowValidator: IWorkflowValidatorService
    ){}

    async execute(input: UpdatePluginByIdInputDTO): Promise<Result<UpdatePluginByIdOutputDTO>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if(!plugin){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const update: Partial<PluginProps> = {};
        if(input.status) update.status = input.status;

        if(input.workflow){
            // Validate the provided workflow.
            const { isValid, errors } = this.workflowValidator.validate(input.workflow);
            update.validated = isValid;
            update.validationErrors = errors;

            // Binary fields (binaryObjectPath, binaryFileName, binary) are managed
            // exclusively by PluginStorageService (upload/delete endpoints). 
            // Preserve them from the current DB state to prevent frontend overwrites.
            if(!input._allowBinaryFieldUpdate){
                const currentEntrypoint = plugin.props.workflow.props.nodes
                    .find((n) => n.type === WorkflowNodeType.Entrypoint);
                const incomingEntrypoint = input.workflow.nodes
                    .find((n) => n.type === WorkflowNodeType.Entrypoint);

                if(currentEntrypoint?.data?.entrypoint && incomingEntrypoint?.data?.entrypoint){
                    const { binary, binaryObjectPath, binaryFileName } = currentEntrypoint.data.entrypoint;
                    incomingEntrypoint.data.entrypoint = {
                        ...incomingEntrypoint.data.entrypoint,
                        binary,
                        binaryObjectPath,
                        binaryFileName
                    };
                }
            }

            update.workflow = input.workflow;
        }

        // If the user is trying publish this plugin and there are
        // validation errors, throws an error.
        // if(input.status === PluginStatus.Published && !(update.validated ?? plugin.props.validated)){
        //    return Result.fail(ApplicationError.notFound(
        //        ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
        //        'Plugin not valid, cannot publish'
        //    ));
        // }

        await this.pluginRepository.updateById(input.pluginId, update);

        return Result.ok(plugin.props);
    }
}
