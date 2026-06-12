import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { ValidateWorkflowUseCase } from '@modules/plugin/application/use-cases/plugin/ValidateWorkflowUseCase';
import type { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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

    constructor(
        protected readonly useCase: ValidateWorkflowUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const result = await this.useCase.execute({
            workflow: params.workflow as unknown as WorkflowProps,
            pluginId: params.pluginId
        });
        if (!result.success) throw result.error;

        const value = result.value;
        const summary = value.validated
            ? 'Workflow is valid and publishable.'
            : `Workflow is invalid: ${(value.errors ?? []).join('; ') || 'see errors.'}`;
        return { summary, data: value };
    }
}
