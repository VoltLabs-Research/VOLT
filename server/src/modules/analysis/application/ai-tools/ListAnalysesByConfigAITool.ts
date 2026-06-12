import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListAnalysesByConfigAITool extends AITool {
    readonly name = 'list_analyses_by_config';
    readonly description = "List a trajectory's analyses filtered by config key/value, status, and minimum completed-frame count — useful for finding duplicate or matching runs.";
    readonly parameters = z.object({
        trajectoryId: z.string(),
        configFilter: z.record(z.string(), z.unknown()).optional(),
        status: z.string().optional(),
        minCompletedFrames: z.number().optional()
    });

    constructor(
        protected readonly useCase: GetAnalysesByTrajectoryIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        // Page through all analyses for the trajectory so the in-tool filter
        // sees the full set rather than a single page.
        const result = await this.useCase.execute({
            trajectoryId: params.trajectoryId,
            teamId: scope.teamId,
            page: 1,
            limit: 1000
        });
        if (!result.success) throw result.error;

        const configFilter = params.configFilter ?? {};
        const configFilterKeys = Object.keys(configFilter);

        const filtered = result.value.data.filter((analysis) => {
            if (params.status && analysis.status !== params.status) {
                return false;
            }
            if (typeof params.minCompletedFrames === 'number' && (analysis.completedFrames ?? 0) < params.minCompletedFrames) {
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
            summary: `Matched ${filtered.length} of ${result.value.total} analyses for trajectory ${params.trajectoryId}.`,
            data: filtered
        };
    }
}
