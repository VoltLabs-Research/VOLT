import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ExecutePipelineAITool extends AITool {
    readonly name = 'execute_pipeline';
    readonly description = 'Run an analysis pipeline on a trajectory: an ORDERED list of plugin stages executed sequentially on the team cluster. This is the ONLY way to run analysis — there is no single-plugin path. To run just one plugin, pass a one-stage pipeline. Stages run in array order against one evolving frame, so a stage that requiresExposures (see list_plugins) must come AFTER a stage whose producesExposures includes those ids (e.g. a reconstruction stage that emits a cluster table before a dislocation stage that consumes it). Call describe_plugin_arguments per plugin first to build each stage config. Returns the analysisId of every computed stage, in order, to track with get_analysis.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        stages: z.array(z.object({
            pluginId: z.string(),
            config: z.record(z.string(), z.unknown()).optional().default({})
        })).min(1).describe('Ordered plugin stages. An upstream stage must precede any stage that consumes its exposures.'),
        selectedTimesteps: z.array(z.number()).optional(),
        teamClusterId: z.string().optional(),
        reason: z.string().optional()
    });

    readonly needsApproval = true;

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.executePipeline({
            trajectoryId: params.trajectoryId,
            teamId: scope.teamId,
            userId: scope.userId,
            selectedTimesteps: params.selectedTimesteps,
            teamClusterId: params.teamClusterId,
            stages: params.stages.map((stage) => ({ kind: 'plugin', pluginId: stage.pluginId, config: stage.config }))
        });

        const analysisIds = result.analysisIds;
        const summary = analysisIds.length
            ? `Started a ${params.stages.length}-stage pipeline. Computed analyses (in order): ${analysisIds.join(', ')}. Track each with get_analysis.`
            : 'Every pipeline stage was served from cache; no new analysis was created.';
        return { summary, data: result };
    }
}
