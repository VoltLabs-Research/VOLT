import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { CreateAnalysisUseCase } from '@modules/analysis/application/use-cases/CreateAnalysisUseCase';

@injectable()
export class CreateAnalysisAITool extends AITool {
    readonly name = 'create_analysis';
    readonly description = 'Create a new analysis.';
    readonly parameters = z.object({ trajectoryId: z.string(), pluginId: z.string(), reason: z.string().optional() });

    constructor(
        @inject(CreateAnalysisUseCase)
        protected readonly useCase: CreateAnalysisUseCase
    ) {
        super();
    }
}
