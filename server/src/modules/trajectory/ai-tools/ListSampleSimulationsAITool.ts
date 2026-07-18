import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

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
