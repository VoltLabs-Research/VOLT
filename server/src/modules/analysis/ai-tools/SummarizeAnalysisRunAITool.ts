import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class SummarizeAnalysisRunAITool extends AITool {
    readonly name = 'summarize_analysis_run';
    readonly description = 'Produce a plain-language summary of a single analysis run: plugin, config, frame progress, status, failed frames, runtime, and artifact readiness.';
    readonly parameters = z.object({ analysisId: z.string() });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const analysis = await this.#service.getAnalysisById({
            analysisId: params.analysisId,
            teamId: scope.teamId
        });
        const totalFrames = analysis.totalFrames ?? 0;

        const failedStageFrames = (analysis.stages ?? [])
            .filter((stage) => stage.status === 'failed' && typeof stage.timestep === 'number')
            .map((stage) => stage.timestep as number);
        const failedFrames = Array.from(new Set(failedStageFrames)).sort((first, second) => first - second);

        const artifacts = analysis.expectedArtifacts ?? [];
        const readyArtifacts = artifacts.filter((artifact) => artifact.status === 'ready').length;
        const failedArtifacts = artifacts.filter((artifact) => artifact.status === 'failed').length;

        let runtimeMs: number | null = null;
        if (analysis.startedAt && analysis.finishedAt) {
            runtimeMs = new Date(analysis.finishedAt).getTime() - new Date(analysis.startedAt).getTime();
        }

        const data = {
            plugin: analysis.plugin,
            pluginDisplayName: analysis.pluginDisplayName,
            config: analysis.config,
            frameRange: {
                totalFrames
            },
            status: analysis.status,
            failedFrames,
            failedFrameCount: failedFrames.length,
            runtime: {
                startedAt: analysis.startedAt,
                finishedAt: analysis.finishedAt,
                runtimeMs
            },
            artifactReadiness: {
                artifactStatus: analysis.artifactStatus,
                total: artifacts.length,
                ready: readyArtifacts,
                failed: failedArtifacts
            }
        };

        const runtimeText = runtimeMs !== null ? `, ran ${(runtimeMs / 1000).toFixed(1)}s` : '';
        const summary = `${analysis.pluginDisplayName} run is ${analysis.status} (${totalFrames} frames, ${readyArtifacts}/${artifacts.length} artifacts ready, ${failedFrames.length} failed frames${runtimeText}).`;

        return { summary, data };
    }
}
