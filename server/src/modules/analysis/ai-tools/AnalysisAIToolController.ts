import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import type { GetAnalysisByIdResult } from '@modules/analysis/services/AnalysisService';
import type {
    AnalysisRefInput,
    CompareAnalysesInput,
    DeleteAnalysisInput,
    GetAnalysisFrameLogInput,
    ListAnalysesByConfigInput,
    ListAnalysesInput,
    ListTrajectoryAnalysesInput
} from '@volt/contracts/modules/analysis/ai-tools';

interface ConfigDelta {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    changed: Record<string, { a: unknown; b: unknown }>;
    unchangedKeys: string[];
}

@AIToolProvider()
export default class AnalysisAIToolController extends AIToolController {
    #service = new AnalysisService();

    @AITool({
        name: 'list_analyses',
        description: 'List all analyses in the team.',
        parameters: typia.llm.parameters<ListAnalysesInput>(),
        validate: typia.createValidate<ListAnalysesInput>()
    })
    async listAnalyses(input: ListAnalysesInput & AIToolScope) {
        // typia validates but does not transform, so the documented defaults are
        // applied here; an absent key does not override them on spread.
        const { total, data } = await this.#service.getAnalysesByTeamId({
            page: 1,
            limit: 50,
            ...input
        });
        return {
            summary: `Found ${total} analyses.`,
            data
        };
    }

    @AITool({
        name: 'list_trajectory_analyses',
        description: 'List all analyses for a specific trajectory.',
        parameters: typia.llm.parameters<ListTrajectoryAnalysesInput>(),
        validate: typia.createValidate<ListTrajectoryAnalysesInput>()
    })
    async listTrajectoryAnalyses(input: ListTrajectoryAnalysesInput & AIToolScope) {
        const { total, data } = await this.#service.getAnalysesByTrajectoryId({
            page: 1,
            limit: 50,
            ...input
        });
        return {
            summary: `Found ${total} analyses for trajectory ${input.trajectoryId}.`,
            data
        };
    }

    @AITool({
        name: 'list_analyses_by_config',
        description: "List a trajectory's analyses filtered by config key/value and status — useful for finding duplicate or matching runs.",
        parameters: typia.llm.parameters<ListAnalysesByConfigInput>(),
        validate: typia.createValidate<ListAnalysesByConfigInput>()
    })
    async listAnalysesByConfig(input: ListAnalysesByConfigInput & AIToolScope) {
        const { total, data } = await this.#service.getAnalysesByTrajectoryId({
            ...input,
            page: 1,
            limit: 1000
        });

        const configFilter = input.configFilter ?? {};
        const configFilterKeys = Object.keys(configFilter);

        const filtered = data.filter((analysis) => {
            if (input.status && analysis.status !== input.status) {
                return false;
            }
            const config = analysis.config;
            for (const key of configFilterKeys) {
                if (JSON.stringify(config[key]) !== JSON.stringify(configFilter[key])) {
                    return false;
                }
            }
            return true;
        });

        return {
            summary: `Matched ${filtered.length} of ${total} analyses for trajectory ${input.trajectoryId}.`,
            data: filtered
        };
    }

    @AITool({
        name: 'get_analysis',
        description: 'Get detailed information about a specific analysis.',
        parameters: typia.llm.parameters<AnalysisRefInput>(),
        validate: typia.createValidate<AnalysisRefInput>()
    })
    async getAnalysis(input: AnalysisRefInput & AIToolScope) {
        const analysis = await this.#service.getAnalysisById(input);
        return {
            summary: `Retrieved analysis ${input.analysisId}.`,
            data: analysis
        };
    }

    @AITool({
        name: 'get_analysis_artifacts',
        description: 'List the expected artifacts of an analysis with their readiness (exposureId, name, status, objectName, isPrimary, readyAt).',
        parameters: typia.llm.parameters<AnalysisRefInput>(),
        validate: typia.createValidate<AnalysisRefInput>()
    })
    async getAnalysisArtifacts(input: AnalysisRefInput & AIToolScope) {
        const { expectedArtifacts } = await this.#service.getAnalysisById(input);

        const artifacts = (expectedArtifacts ?? []).map((artifact) => ({
            exposureId: artifact.exposureId,
            name: artifact.name,
            status: artifact.status,
            objectName: artifact.objectName,
            isPrimary: artifact.isPrimary ?? false,
            readyAt: artifact.readyAt
        }));

        const readyCount = artifacts.filter((artifact) => artifact.status === 'ready').length;

        return {
            summary: `${readyCount}/${artifacts.length} artifacts ready for analysis ${input.analysisId}.`,
            data: artifacts
        };
    }

    @AITool({
        name: 'get_analysis_frame_log',
        description: 'Get the execution log for a specific analysis frame.',
        parameters: typia.llm.parameters<GetAnalysisFrameLogInput>(),
        validate: typia.createValidate<GetAnalysisFrameLogInput>()
    })
    async getAnalysisFrameLog(input: GetAnalysisFrameLogInput & AIToolScope) {
        return this.#service.getAnalysisFrameLog(input);
    }

    @AITool({
        name: 'summarize_analysis_run',
        description: 'Produce a plain-language summary of a single analysis run: plugin, config, frame progress, status, failed frames, runtime, and artifact readiness.',
        parameters: typia.llm.parameters<AnalysisRefInput>(),
        validate: typia.createValidate<AnalysisRefInput>()
    })
    async summarizeAnalysisRun(input: AnalysisRefInput & AIToolScope) {
        const analysis = await this.#service.getAnalysisById(input);
        const totalFrames = analysis.totalFrames ?? 0;

        const failedStageFrames = (analysis.stages ?? [])
            .flatMap((stage) => stage.status === 'failed' && stage.timestep !== undefined
                ? [stage.timestep]
                : []);
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

        return {
            summary,
            data
        };
    }

    @AITool({
        name: 'compare_analyses',
        description: 'Compare two analysis runs side by side (config, status, frame progress, expected artifacts, stages, child analyses, timestamps) to tell which run is more complete or cleaner — useful for resolving duplicate-run confusion.',
        parameters: typia.llm.parameters<CompareAnalysesInput>(),
        validate: typia.createValidate<CompareAnalysesInput>()
    })
    async compareAnalyses(input: CompareAnalysesInput & AIToolScope) {
        const [a, b] = await Promise.all([
            this.#service.getAnalysisById({
                teamId: input.teamId,
                analysisId: input.analysisIdA
            }),
            this.#service.getAnalysisById({
                teamId: input.teamId,
                analysisId: input.analysisIdB
            })
        ]);

        const configDelta = this.#diffConfig(a.config, b.config);
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
            a: this.#summarizeArtifacts(a),
            b: this.#summarizeArtifacts(b)
        };

        const summary = this.#buildSummary(input.analysisIdA, input.analysisIdB, a, b);

        return {
            summary,
            data: {
                configDelta,
                statusDelta,
                frameDelta,
                artifactDelta,
                a: this.#snapshot(input.analysisIdA, a),
                b: this.#snapshot(input.analysisIdB, b)
            }
        };
    }

    @AITool({
        name: 'retry_failed_analysis_frames',
        description: 'Retry the failed frames of an analysis.',
        parameters: typia.llm.parameters<AnalysisRefInput>(),
        validate: typia.createValidate<AnalysisRefInput>()
    })
    async retryFailedAnalysisFrames(input: AnalysisRefInput & AIToolScope) {
        return this.#service.retryFailedFrames(input);
    }

    @AITool({
        name: 'delete_analysis',
        description: 'Delete an analysis.',
        parameters: typia.llm.parameters<DeleteAnalysisInput>(),
        validate: typia.createValidate<DeleteAnalysisInput>()
    })
    async deleteAnalysis(input: DeleteAnalysisInput & AIToolScope) {
        return this.#service.deleteAnalysisById(input);
    }

    #diffConfig(a: Record<string, unknown>, b: Record<string, unknown>): ConfigDelta {
        const added: Record<string, unknown> = {};
        const removed: Record<string, unknown> = {};
        const changed: Record<string, { a: unknown; b: unknown }> = {};
        const unchangedKeys: string[] = [];

        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) {
            const hasA = Object.prototype.hasOwnProperty.call(a, key);
            const hasB = Object.prototype.hasOwnProperty.call(b, key);
            if (hasA && !hasB) {
                removed[key] = a[key];
            } else if (!hasA && hasB) {
                added[key] = b[key];
            } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
                changed[key] = {
                    a: a[key],
                    b: b[key]
                };
            } else {
                unchangedKeys.push(key);
            }
        }

        return {
            added,
            removed,
            changed,
            unchangedKeys
        };
    }

    #summarizeArtifacts(analysis: GetAnalysisByIdResult) {
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

    #snapshot(id: string, analysis: GetAnalysisByIdResult) {
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

    #completeness(analysis: GetAnalysisByIdResult): number {
        const artifacts = analysis.expectedArtifacts ?? [];
        if (analysis.status === 'completed') return 1;
        if (artifacts.length > 0) {
            return artifacts.filter((artifact) => artifact.status === 'ready').length / artifacts.length;
        }
        return analysis.status === 'failed' ? 0 : 0.5;
    }

    #buildSummary(idA: string, idB: string, a: GetAnalysisByIdResult, b: GetAnalysisByIdResult): string {
        const completenessA = this.#completeness(a);
        const completenessB = this.#completeness(b);
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
