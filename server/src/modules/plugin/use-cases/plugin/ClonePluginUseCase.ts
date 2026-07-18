import type { IPluginRepository } from '@modules/plugin/ports/plugin/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/di/PluginTokens';
import { ClonePluginInputDTO, ClonePluginOutputDTO } from '@modules/plugin/dtos/plugin/ClonePluginDTO';
import { PluginStatus } from '@modules/plugin/entities/plugin/Plugin';
import Workflow from '@modules/plugin/entities/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/entities/plugin/workflow/WorkflowNode';
import PluginCreatedEvent from '@modules/plugin/events/PluginCreatedEvent';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ClonePluginUseCase implements IUseCase<ClonePluginInputDTO, ClonePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    async execute(input: ClonePluginInputDTO): Promise<ClonePluginOutputDTO> {
        const original = await this.pluginRepository.findById(input.pluginId);
        if (!original) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const clonedNodes = original.props.workflow.props.nodes.map((node) => {
            if (node.type !== WorkflowNodeType.Modifier) return node;
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

        return {
            plugin: mapPluginToPersistedDTO(plugin)
        };
    }
}
