import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetAnalysisArtifactsAITool extends AITool {
    readonly name = 'get_analysis_artifacts';
    readonly description = 'List the expected artifacts of an analysis with their readiness (exposureId, name, status, objectName, isPrimary, readyAt).';
    readonly parameters = z.object({ analysisId: z.string() });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getAnalysisById({
            analysisId: params.analysisId,
            teamId: scope.teamId
        });

        const artifacts = (value.expectedArtifacts ?? []).map((artifact) => ({
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
