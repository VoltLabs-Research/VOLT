import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ListSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/ListSampleSimulationsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListSampleSimulationsAITool extends AITool {
    readonly name = 'list_sample_simulations';
    readonly description = 'List the bundled sample simulations available to import.';
    readonly parameters = z.object({});

    constructor(
        protected readonly useCase: ListSampleSimulationsUseCase
    ) {
        super();
    }

    async execute(_params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const result = await this.useCase.execute();
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.length} sample simulations.`, data: result.value };
    }
}
