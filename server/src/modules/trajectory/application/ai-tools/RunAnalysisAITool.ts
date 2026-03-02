import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { CreateAnalysisUseCase } from '@modules/analysis/application/use-cases/CreateAnalysisUseCase';

@injectable()
export class RunAnalysisAITool extends AITool {
    readonly name = 'run_analysis';
    readonly description = 'Execute a plugin analysis on a trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string(), pluginId: z.string(), reason: z.string().optional() });

    constructor(
        @inject(CreateAnalysisUseCase)
        protected readonly useCase: CreateAnalysisUseCase
    ) {
        super();
    }
}
