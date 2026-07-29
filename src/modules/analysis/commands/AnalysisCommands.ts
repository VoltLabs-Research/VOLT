import { getAnalysisDispatcher } from '@modules/analysis/services/AnalysisDispatcher';
import type {
    AnalysisRuntimeCleanupRequest,
    AnalysisStartRequest,
    AnalysisStartRequestWithTrace,
    AnalysisStartTransportPayload
} from '@shared/contracts';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import { extractDaemonTraceContext } from '@shared/infrastructure/observability/daemon-instrumentation';
import { inflateBase64GzipJson } from '@shared/application/utilities/gzip-base64-json';
import type { AnalysisDispatcher } from '@modules/analysis/services/AnalysisDispatcher';
import { RuntimeStateCleanupControl, getRuntimeStateCleanupControl } from '@modules/jobs/services/RuntimeStateCleanupControl';

const readCompressed = async <T>(compressed: string): Promise<T> => inflateBase64GzipJson<T>(compressed);

@CommandGroup('analysis')
export class AnalysisCommands {
    constructor(
        private readonly analysisDispatcher: AnalysisDispatcher,
        private readonly runtimeStateCleanupControl: RuntimeStateCleanupControl
    ) {}

    @Command('start')
    async start(payload: AnalysisStartTransportPayload) {
        return this.analysisDispatcher.startAnalysis(await this.readAnalysisStartRequest(payload));
    }

    @Command('cleanup-runtime-state')
    cleanupRuntimeState(payload: AnalysisRuntimeCleanupRequest) {
        return this.runtimeStateCleanupControl.cleanupAnalysisRuntimeState(payload);
    }

    private async readAnalysisStartRequest(payload: AnalysisStartTransportPayload): Promise<AnalysisStartRequestWithTrace> {
        const request = { ...payload } as AnalysisStartRequestWithTrace;

        const [
            trajectoryFrames,
            workflow,
            nestedPlugins,
            pluginReferenceExecutions
        ] = await Promise.all([
            readCompressed<AnalysisStartRequest['trajectoryFrames']>(payload.trajectoryFramesCompressed),
            readCompressed<AnalysisStartRequest['workflow']>(payload.workflowCompressed),
            readCompressed<AnalysisStartRequest['nestedPlugins']>(payload.nestedPluginsCompressed),
            readCompressed<AnalysisStartRequest['pluginReferenceExecutions']>(
                payload.pluginReferenceExecutionsCompressed
            )
        ]);
        request.trajectoryFrames = trajectoryFrames;
        request.workflow = workflow;
        request.nestedPlugins = nestedPlugins;
        request.pluginReferenceExecutions = pluginReferenceExecutions;

        const traceContext = extractDaemonTraceContext(payload as unknown as Record<string, unknown>);
        if (traceContext) {
            request.traceContext = traceContext;
        }

        return request;
    }
}

export const getAnalysisCommands = commandGroupFactory(AnalysisCommands, () => new AnalysisCommands(getAnalysisDispatcher(), getRuntimeStateCleanupControl()));
