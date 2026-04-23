import { UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/UpdatePluginByIdDTO';
import { PluginProps, PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import PluginPublishedEvent from '@modules/plugin/domain/events/PluginPublishedEvent';
import { WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/plugin/WorkflowValidatorService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

@Singleton()
export class UpdatePluginByIdUseCase implements IUseCase<UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO> {
    constructor(
        
        private pluginRepository: PluginRepository,

        
        private workflowValidator: WorkflowValidatorService,

        @inject(SHARED_TOKENS.EventBus)
        private eventBus: IEventBus
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
            const effectiveStatus = input.status ?? plugin.props.status;
            const validationMode = effectiveStatus === PluginStatus.Published
                ? WorkflowValidationMode.Strict
                : WorkflowValidationMode.Draft;
            const { isValid, errors } = await this.workflowValidator.validate(input.workflow, plugin.id, validationMode);
            if(effectiveStatus === PluginStatus.Published && !isValid){
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
            const { isValid, errors } = await this.workflowValidator.validate(plugin.props.workflow.props, plugin.id, WorkflowValidationMode.Strict);
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

        const transitionedToPublished = input.status === PluginStatus.Published
            && plugin.props.status !== PluginStatus.Published;

        if (transitionedToPublished) {
            const entrypointNode = updatedPlugin.props.workflow.props.nodes
                .find((node) => node.type === WorkflowNodeType.Entrypoint);
            const entrypoint = entrypointNode?.data?.entrypoint;

            await this.eventBus.publish(new PluginPublishedEvent({
                pluginId: updatedPlugin.id,
                teamId: updatedPlugin.props.team,
                binaryObjectPath: entrypoint?.binaryObjectPath,
                requirementsFile: entrypoint?.requirementsFile,
                entrypointScript: entrypoint?.entrypointScript,
                binaryHash: entrypoint?.binaryHash
            })).catch((error: unknown) => {
                logger.warn({ err: error, pluginId: updatedPlugin.id }, '@update-plugin-by-id: failed to publish PluginPublishedEvent');
            });
        }

        return Result.ok(mapPluginToPersistedDTO(updatedPlugin));
    }
};
