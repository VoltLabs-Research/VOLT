import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { ClonePluginInputDTO, ClonePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ClonePluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import WorkflowProjectionService from '@modules/plugin/domain/services/WorkflowProjectionService';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';
import { ErrorCodes } from '@core/constants/error-codes';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import slugify from '@shared/infrastructure/utilities/slugify';

@injectable()
export class ClonePluginUseCase implements IUseCase<ClonePluginInputDTO, ClonePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
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

        const newSlug = `${slugify(original.props.slug)}-copy-${Date.now()}`;
        const workflow = new Workflow('', clonedWorkflowProps);
        const projection = WorkflowProjectionService.project(workflow, newSlug);

        const plugin = await this.pluginRepository.create({
            workflow: clonedWorkflowProps as any,
            team: input.teamId,
            slug: newSlug,
            validated: original.props.validated,
            status: PluginStatus.Draft,
            ...projection
        });

        return Result.ok({ plugin });
    }
}
