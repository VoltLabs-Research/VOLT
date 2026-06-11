import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import ListSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/ListSampleSimulationsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
