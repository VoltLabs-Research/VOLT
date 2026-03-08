import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import type { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import type { WorkflowProps } from '@modules/plugin/domain/entities/workflow/Workflow';

const buildWorkflowWithModifierName = (
    workflow: WorkflowProps,
    modifierName: string
): WorkflowProps => {
    return {
        ...workflow,
        nodes: workflow.nodes.map((node) => {
            if (node.type !== WorkflowNodeType.Modifier) {
                return node;
            }

            return {
                ...node,
                data: {
                    ...node.data,
                    modifier: {
                        ...node.data.modifier,
                        name: modifierName
                    }
                }
            };
        })
    };
};

@injectable()
export class UpdatePluginAITool extends AITool {
    readonly name = 'update_plugin';
    readonly description = 'Update a plugin.';
    readonly parameters = z.object({
        pluginId: z.string(),
        name: z.string().optional(),
        reason: z.string().optional()
    });
    protected needsApproval = true;

    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepo: IPluginRepository,
        @inject(UpdatePluginByIdUseCase)
        private readonly updatePluginUseCase: UpdatePluginByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const { pluginId, name } = params;

        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');
        }

        if (name !== undefined) {
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                    'Plugin name cannot be empty'
                );
            }

            const hasModifierNode = plugin.props.workflow.props.nodes.some(
                (node) => node.type === WorkflowNodeType.Modifier
            );
            if (!hasModifierNode) {
                throw ApplicationError.badRequest(
                    ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                    'Plugin workflow must include a modifier node'
                );
            }

            const result = await this.updatePluginUseCase.execute({
                pluginId,
                workflow: buildWorkflowWithModifierName(plugin.props.workflow.props, trimmedName)
            });

            if (!result.success) {
                throw result.error instanceof ApplicationError
                    ? result.error
                    : new Error(String(result.error));
            }
        }

        return {
            summary: `Plugin "${pluginId}" updated.`,
            result: { pluginId }
        };
    }
}
