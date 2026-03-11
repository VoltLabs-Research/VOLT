import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/UpdatePluginByIdDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { PluginProps, PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { IWorkflowValidatorService } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';


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
            if(input.status === PluginStatus.Published && !isValid){
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                    `Plugin not valid, cannot publish: ${(errors ?? []).join(', ')}`
                ));
            }

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

            const workflow = new Workflow(plugin._id, input.workflow);
            const projection = WorkflowProjectionService.project(workflow, plugin._id);

            update.workflow = workflow;
            update.modifier = projection.modifier;
            update.exposures = projection.exposures;
            update.arguments = projection.arguments;
            update.listingExposures = projection.listingExposures;
        }

        if(input.status === PluginStatus.Published && !input.workflow){
            // No workflow provided with publish request - validate the existing workflow.
            const { isValid, errors } = this.workflowValidator.validate(plugin.props.workflow.props);
            if(!isValid){
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                    `Plugin not valid, cannot publish: ${(errors ?? []).join(', ')}`
                ));
            }
        }

        const updatedPlugin = await this.pluginRepository.updateById(input.pluginId, update);

        if(!updatedPlugin){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(mapPluginToPersistedDTO(updatedPlugin));
    }
};
