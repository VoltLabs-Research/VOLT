import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetAnalysisByIdUseCase from '@modules/analysis/application/use-cases/GetAnalysisByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetAnalysisArtifactsAITool extends AITool {
    readonly name = 'get_analysis_artifacts';
    readonly description = 'List the expected artifacts of an analysis with their readiness (exposureId, name, status, objectName, isPrimary, readyAt).';
    readonly parameters = z.object({ analysisId: z.string() });

    constructor(
        protected readonly useCase: GetAnalysisByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            analysisId: params.analysisId,
            teamId: scope.teamId
        });
        if (!result.success) throw result.error;

        const artifacts = (result.value.expectedArtifacts ?? []).map((artifact) => ({
            exposureId: artifact.exposureId,
            name: artifact.name,
            status: artifact.status,
            objectName: artifact.objectName,
            isPrimary: artifact.isPrimary ?? false,
            readyAt: artifact.readyAt
        }));

        const readyCount = artifacts.filter((artifact) => artifact.status === 'ready').length;

        return {
            summary: `${readyCount}/${artifacts.length} artifacts ready for analysis ${params.analysisId}.`,
            data: artifacts
        };
    }
}
