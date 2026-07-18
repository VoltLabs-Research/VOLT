import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListSampleSimulationsAITool extends AITool {
    readonly name = 'list_sample_simulations';
    readonly description = 'List the bundled sample simulations available to import.';
    readonly parameters = z.object({});

    #service = new TrajectoryService();

    async execute(_params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const value = await this.#service.listSamples();
        return { summary: `Found ${value.length} sample simulations.`, data: value };
    }
}
