import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import type { GetAnalysisByIdResult } from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

interface ConfigDelta {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    changed: Record<string, { a: unknown; b: unknown }>;
    unchangedKeys: string[];
}

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class CompareAnalysesAITool extends AITool {
    readonly name = 'compare_analyses';
    readonly description = 'Compare two analysis runs side by side (config, status, frame progress, expected artifacts, stages, child analyses, timestamps) to tell which run is more complete or cleaner — useful for resolving duplicate-run confusion.';
    readonly parameters = z.object({
        analysisIdA: z.string(),
        analysisIdB: z.string()
    });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const [a, b] = await Promise.all([
            this.#service.getAnalysisById({ analysisId: params.analysisIdA, teamId: scope.teamId }),
            this.#service.getAnalysisById({ analysisId: params.analysisIdB, teamId: scope.teamId })
        ]);

        const configDelta = this.diffConfig(a.config, b.config);
        const statusDelta = {
            a: a.status,
            b: b.status,
            same: a.status === b.status
        };
        const frameDelta = {
            a: { totalFrames: a.totalFrames ?? 0 },
            b: { totalFrames: b.totalFrames ?? 0 }
        };
        const artifactDelta = {
            a: this.summarizeArtifacts(a),
            b: this.summarizeArtifacts(b)
        };

        const summary = this.buildSummary(params.analysisIdA, params.analysisIdB, a, b);

        return {
            summary,
            data: {
                configDelta,
                statusDelta,
                frameDelta,
                artifactDelta,
                a: this.snapshot(params.analysisIdA, a),
                b: this.snapshot(params.analysisIdB, b)
            }
        };
    }

    private diffConfig(a: Record<string, unknown>, b: Record<string, unknown>): ConfigDelta {
        const added: Record<string, unknown> = {};
        const removed: Record<string, unknown> = {};
        const changed: Record<string, { a: unknown; b: unknown }> = {};
        const unchangedKeys: string[] = [];

        const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
        for (const key of keys) {
            const hasA = Object.prototype.hasOwnProperty.call(a ?? {}, key);
            const hasB = Object.prototype.hasOwnProperty.call(b ?? {}, key);
            if (hasA && !hasB) {
                removed[key] = a[key];
            } else if (!hasA && hasB) {
                added[key] = b[key];
            } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
                changed[key] = { a: a[key], b: b[key] };
            } else {
                unchangedKeys.push(key);
            }
        }

        return { added, removed, changed, unchangedKeys };
    }

    private summarizeArtifacts(analysis: GetAnalysisByIdResult) {
        const artifacts = analysis.expectedArtifacts ?? [];
        const ready = artifacts.filter((artifact) => artifact.status === 'ready').length;
        const failed = artifacts.filter((artifact) => artifact.status === 'failed').length;
        return {
            total: artifacts.length,
            ready,
            failed,
            artifactStatus: analysis.artifactStatus
        };
    }

    private snapshot(id: string, analysis: GetAnalysisByIdResult) {
        return {
            _id: id,
            plugin: analysis.plugin,
            pluginDisplayName: analysis.pluginDisplayName,
            status: analysis.status,
            totalFrames: analysis.totalFrames ?? 0,
            stageCount: analysis.stages?.length ?? 0,
            childAnalysisCount: analysis.childAnalyses?.length ?? 0,
            startedAt: analysis.startedAt,
            finishedAt: analysis.finishedAt,
            createdAt: analysis.createdAt,
            updatedAt: analysis.updatedAt
        };
    }

    private completeness(analysis: GetAnalysisByIdResult): number {
        const artifacts = analysis.expectedArtifacts ?? [];
        if (analysis.status === 'completed') return 1;
        if (artifacts.length > 0) {
            return artifacts.filter((artifact) => artifact.status === 'ready').length / artifacts.length;
        }
        return analysis.status === 'failed' ? 0 : 0.5;
    }

    private buildSummary(idA: string, idB: string, a: GetAnalysisByIdResult, b: GetAnalysisByIdResult): string {
        const completenessA = this.completeness(a);
        const completenessB = this.completeness(b);
        const failedA = (a.expectedArtifacts ?? []).filter((artifact) => artifact.status === 'failed').length;
        const failedB = (b.expectedArtifacts ?? []).filter((artifact) => artifact.status === 'failed').length;

        let verdict: string;
        if (completenessA > completenessB || (completenessA === completenessB && failedA < failedB)) {
            verdict = `Run A (${idA}) looks more complete/clean`;
        } else if (completenessB > completenessA || (completenessA === completenessB && failedB < failedA)) {
            verdict = `Run B (${idB}) looks more complete/clean`;
        } else {
            verdict = 'Both runs look equivalent';
        }

        return `${verdict}: A is ${(completenessA * 100).toFixed(0)}% complete (status ${a.status}, ${failedA} failed artifacts), B is ${(completenessB * 100).toFixed(0)}% complete (status ${b.status}, ${failedB} failed artifacts).`;
    }
}
