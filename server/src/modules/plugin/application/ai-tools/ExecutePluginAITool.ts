import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { ExecutePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePluginUseCase';
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
        protected readonly useCase: ExecutePluginUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            pluginId: params.pluginId,
            trajectoryId: params.trajectoryId,
            teamId: scope.teamId,
            userId: scope.userId,
            config: params.config,
            selectedTimesteps: params.selectedTimesteps,
            teamClusterId: params.teamClusterId
        });
        if (!result.success) throw result.error;

        return {
            summary: `Started analysis ${result.value.analysisId}. Track its progress with get_analysis.`,
            data: result.value
        };
    }
}
