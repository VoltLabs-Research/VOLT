import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ClonePluginInputDTO, ClonePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ClonePluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { ErrorCodes } from '@core/constants/error-codes';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';


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

        const plugin = await this.pluginRepository.create({
            workflow: clonedWorkflowProps as any,
            team: input.teamId,
            validated: original.props.validated,
            status: PluginStatus.Draft
        });

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin.id,
            teamId: input.teamId
        }));

        return Result.ok({ plugin });
    }
}
