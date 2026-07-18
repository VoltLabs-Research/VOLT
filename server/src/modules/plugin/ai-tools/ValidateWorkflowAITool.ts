import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import type { WorkflowProps } from '@modules/plugin/entities/plugin/workflow/Workflow';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ValidateWorkflowAITool extends AITool {
    readonly name = 'validate_workflow';
    readonly description = 'Validate a plugin workflow graph (nodes + edges) in strict mode and report whether it is publishable, listing any structural errors. Pass pluginId to validate an existing plugin\'s draft graph.';
    readonly parameters = z.object({
        workflow: z.object({
            nodes: z.array(z.record(z.string(), z.unknown())),
            edges: z.array(z.record(z.string(), z.unknown())),
            viewport: z.object({
                x: z.number(),
                y: z.number(),
                zoom: z.number()
            }).optional()
        }),
        pluginId: z.string().optional()
    });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const result = await this.#service.validateWorkflow({
            workflow: params.workflow as unknown as WorkflowProps,
            pluginId: params.pluginId
        });

        const value = result;
        const summary = value.validated
            ? 'Workflow is valid and publishable.'
            : `Workflow is invalid: ${(value.errors ?? []).join('; ') || 'see errors.'}`;
        return { summary, data: value };
    }
}
