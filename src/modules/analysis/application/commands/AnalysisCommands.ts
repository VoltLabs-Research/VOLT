import type {
    AnalysisRuntimeCleanupRequest,
    AnalysisStartRequest,
    AnalysisStartRequestWithTrace,
    AnalysisStartTransportPayload
} from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import { extractDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { inflateBase64GzipJson } from '@/support/serialization/gzip-base64-json';
import type { AnalysisDispatcher } from '@/modules/analysis/application/analysis/AnalysisDispatcher';
import { RuntimeStateCleanupControl } from '@/modules/jobs/application/control/RuntimeStateCleanupControl';

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

        request.trajectoryFrames = await readCompressed<AnalysisStartRequest['trajectoryFrames']>(
            payload.trajectoryFramesCompressed);
        request.workflow = await readCompressed<AnalysisStartRequest['workflow']>(
            payload.workflowCompressed);
        request.nestedPlugins = await readCompressed<AnalysisStartRequest['nestedPlugins']>(
            payload.nestedPluginsCompressed);
        request.pluginReferenceExecutions = await readCompressed<AnalysisStartRequest['pluginReferenceExecutions']>(
            payload.pluginReferenceExecutionsCompressed);

        const traceContext = extractDaemonTraceContext(payload as unknown as Record<string, unknown>);
        if (traceContext) {
            request.traceContext = traceContext;
        }

        return request;
    }
}
