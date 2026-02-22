import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/UpdatePluginByIdDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PluginProps, PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { ErrorCodes } from '@core/constants/error-codes';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { IWorkflowValidatorService } from './ValidateWorkflowUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import slugify from '@shared/infrastructure/utilities/slugify';

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
            // Update the plugin slug according to the modifier node name.
            // Only regenerate slug if explicitly requested (not during import/binary updates)
            if(input.workflow?.nodes && input.regenerateSlug !== false){
                const modifierNode = input.workflow.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
                if(modifierNode?.data?.modifier?.name){
                    const newSlug = slugify(modifierNode.data.modifier.name);
                    // Only update if the base slug changed (ignore unique suffixes)
                    const currentBaseSlug = plugin.props.slug?.replace(/-[a-f0-9]{6,}-[a-f0-9]{8}$/i, '');
                    if(newSlug !== currentBaseSlug){
                        update.slug = newSlug;
                    }
                }
            }

            // Validate the provided workflow.
            const { isValid, errors } = this.workflowValidator.validate(input.workflow);
            update.validated = isValid;
            update.validationErrors = errors;
            update.workflow = input.workflow;
        }

        // If the user is trying publish this plugin and there are
        // validation errors, throws an error.
        if(input.status === PluginStatus.Published && !(update.validated ?? plugin.props.validated)){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                'Plugin not valid, cannot publish'
            ));
        }

        await this.pluginRepository.updateById(input.pluginId, update);

        return Result.ok(plugin.props);
    }
}
