import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListAnalysesByConfigAITool extends AITool {
    readonly name = 'list_analyses_by_config';
    readonly description = "List a trajectory's analyses filtered by config key/value and status — useful for finding duplicate or matching runs.";
    readonly parameters = z.object({
        trajectoryId: z.string(),
        configFilter: z.record(z.string(), z.unknown()).optional(),
        status: z.string().optional()
    });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getAnalysesByTrajectoryId({
            trajectoryId: params.trajectoryId,
            teamId: scope.teamId,
            page: 1,
            limit: 1000
        });

        const configFilter = params.configFilter ?? {};
        const configFilterKeys = Object.keys(configFilter);

        const filtered = value.data.filter((analysis) => {
            if (params.status && analysis.status !== params.status) {
                return false;
            }
            const config = analysis.config ?? {};
            for (const key of configFilterKeys) {
                if (JSON.stringify(config[key]) !== JSON.stringify(configFilter[key])) {
                    return false;
                }
            }
            return true;
        });

        return {
            summary: `Matched ${filtered.length} of ${value.total} analyses for trajectory ${params.trajectoryId}.`,
            data: filtered
        };
    }
}
