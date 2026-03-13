import { AITool } from '@shared/application/ai/AITool';
import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';

import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

@injectable()
export class DeleteAnalysisAITool extends AITool {
    readonly name = 'delete_analysis';
    readonly description = 'Delete an analysis.';
    readonly parameters = z.object({ analysisId: z.string(), reason: z.string().optional() });

    constructor(
        @inject(DeleteAnalysisByIdUseCase)
        protected readonly useCase: DeleteAnalysisByIdUseCase
    ) {
        super();
    }
};
