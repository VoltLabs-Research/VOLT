import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ClonePluginInputDTO, ClonePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ClonePluginDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';

import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class ClonePluginUseCase implements IUseCase<ClonePluginInputDTO, ClonePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: ClonePluginInputDTO): Promise<Result<ClonePluginOutputDTO>> {
        const original = await this.pluginRepository.findById(input.pluginId);
        if(!original){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const clonedNodes = original.props.workflow.props.nodes.map((node) => {
            if(node.type !== WorkflowNodeType.Modifier) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    modifier: {
                        ...node.data.modifier,
                        name: `${node.data.modifier!.name} (Copy)`
                    }
                }
            };
        });

        const clonedWorkflowProps = {
            ...original.props.workflow.props,
            nodes: clonedNodes
        };

        const workflow = new Workflow('', clonedWorkflowProps);
        const projection = WorkflowProjectionService.project(workflow, '');

        const plugin = await this.pluginRepository.create({
            workflow,
            team: input.teamId,
            validated: original.props.validated,
            status: PluginStatus.Draft,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin._id,
            teamId: input.teamId
        }));

        return Result.ok({
            plugin: mapPluginToPersistedDTO(plugin)
        });
    }
};
