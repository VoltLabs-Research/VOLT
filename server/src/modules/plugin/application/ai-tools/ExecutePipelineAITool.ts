import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { ExecutePipelineUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePipelineUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ExecutePluginAITool extends AITool {
    readonly name = 'execute_plugin';
    readonly description = 'Run an analysis plugin on a trajectory with a given configuration. Starts real compute on the team cluster and returns an analysisId to track. Call describe_plugin_arguments first to build a valid config.';
    readonly parameters = z.object({
        pluginId: z.string(),
        trajectoryId: z.string(),
        config: z.record(z.string(), z.unknown()).optional().default({}),
        selectedTimesteps: z.array(z.number()).optional(),
        teamClusterId: z.string().optional(),
        reason: z.string().optional()
    });

    // Running a plugin dispatches real compute to the user's cluster — an
    // expensive, side-effecting action. Gate it behind explicit human approval;
    // the AI SDK pauses the stream and the continuation flow resumes on approve.
    readonly needsApproval = true;

    constructor(
        protected readonly useCase: ExecutePipelineUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        // A single plugin run is a one-stage pipeline (the only execution path).
        const result = await this.useCase.execute({
            trajectoryId: params.trajectoryId,
            teamId: scope.teamId,
            userId: scope.userId,
            selectedTimesteps: params.selectedTimesteps,
            teamClusterId: params.teamClusterId,
            stages: [{ kind: 'plugin', pluginId: params.pluginId, config: params.config }]
        });
        if (!result.success) throw result.error;

        const analysisId = result.value.analysisIds[0];
        return {
            summary: analysisId
                ? `Started analysis ${analysisId}. Track its progress with get_analysis.`
                : 'Pipeline stage was served from cache; no new analysis was created.',
            data: result.value
        };
    }
}

