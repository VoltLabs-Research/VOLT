import { getPipelineDispatcher } from '@modules/analysis/services/PipelineDispatcher';
import type {
    AnalysisStartRequest,
    AnalysisStartTransportRequest,
    PipelineStartRequestWithTrace,
    PipelineStartResolvedStage,
    PipelineStartTransportPayload,
    PipelineStageTransport
} from '@shared/contracts';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import { extractDaemonTraceContext } from '@shared/infrastructure/observability/daemon-instrumentation';
import { inflateBase64GzipJson } from '@shared/application/utilities/gzip-base64-json';
import type { PipelineDispatcher } from '@modules/analysis/services/PipelineDispatcher';

const readCompressed = async <T>(compressed: string): Promise<T> => inflateBase64GzipJson<T>(compressed);

@CommandGroup('pipeline')
export class PipelineCommands {
    constructor(private readonly pipelineDispatcher: PipelineDispatcher) {}

    @Command('start')
    async start(payload: PipelineStartTransportPayload) {
        return this.pipelineDispatcher.startPipeline(await this.readPipelineStartRequest(payload));
    }

    private async readPipelineStartRequest(
        payload: PipelineStartTransportPayload
    ): Promise<PipelineStartRequestWithTrace> {
        const stages = await Promise.all(payload.stages.map((stage) => this.readStage(stage)));

        const request: PipelineStartRequestWithTrace = {
            teamId: payload.teamId,
            teamClusterId: payload.teamClusterId,
            trajectoryId: payload.trajectoryId,
            storageClusterId: payload.storageClusterId,
            selectedTimesteps: payload.selectedTimesteps,
            timestep: payload.timestep,
            stages
        };

        const traceContext = extractDaemonTraceContext(payload);
        if (traceContext) {
            request.traceContext = traceContext;
        }

        return request;
    }

    private async readStage(stage: PipelineStageTransport): Promise<PipelineStartResolvedStage> {
        if (stage.kind !== 'plugin' || stage.cacheHit || !stage.plugin) {
            return {
                kind: stage.kind,
                cacheHit: stage.cacheHit,
                cacheSourceAnalysisId: stage.cacheSourceAnalysisId,
                sharedExposureIds: stage.sharedExposureIds,
                config: stage.config
            };
        }

        return {
            kind: 'plugin',
            plugin: await this.readPluginStage(stage.plugin),
            sharedExposureIds: stage.sharedExposureIds
        };
    }

    private async readPluginStage(plugin: AnalysisStartTransportRequest): Promise<AnalysisStartRequest> {
        const [
            trajectoryFrames,
            workflow,
            nestedPlugins,
            pluginReferenceExecutions
        ] = await Promise.all([
            readCompressed<AnalysisStartRequest['trajectoryFrames']>(plugin.trajectoryFramesCompressed),
            readCompressed<AnalysisStartRequest['workflow']>(plugin.workflowCompressed),
            readCompressed<AnalysisStartRequest['nestedPlugins']>(plugin.nestedPluginsCompressed),
            readCompressed<AnalysisStartRequest['pluginReferenceExecutions']>(plugin.pluginReferenceExecutionsCompressed)
        ]);

        return {
            ...plugin,
            trajectoryFrames,
            workflow,
            nestedPlugins,
            pluginReferenceExecutions
        };
    }
}

export const getPipelineCommands = commandGroupFactory(PipelineCommands, () => new PipelineCommands(getPipelineDispatcher()));
