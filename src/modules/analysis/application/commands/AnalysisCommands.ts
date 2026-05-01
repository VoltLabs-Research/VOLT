import type {
    AnalysisStartRequest,
    AnalysisStartRequestWithTrace,
    AnalysisStartTransportPayload
} from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import { extractDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { inflateBase64GzipJson } from '@/support/serialization/gzip-base64-json';
import type { AnalysisDispatcher } from '@/modules/analysis/application/analysis/AnalysisDispatcher';

const readMaybeCompressed = async <T>(compressed: unknown, fallback: T): Promise<T> =>
    typeof compressed === 'string' ? inflateBase64GzipJson<T>(compressed) : fallback;

@CommandGroup('analysis')
export class AnalysisCommands {
    constructor(
        private readonly analysisDispatcher: AnalysisDispatcher
    ) {}

    @Command('start')
    async start(payload: AnalysisStartTransportPayload) {
        return this.analysisDispatcher.startAnalysis(await this.readAnalysisStartRequest(payload));
    }

    private async readAnalysisStartRequest(payload: AnalysisStartTransportPayload): Promise<AnalysisStartRequestWithTrace> {
        const request = { ...payload } as AnalysisStartRequestWithTrace;

        request.trajectoryFrames = await readMaybeCompressed<AnalysisStartRequest['trajectoryFrames']>(
            payload.trajectoryFramesCompressed, payload.trajectoryFrames ?? []);
        request.workflow = await readMaybeCompressed<AnalysisStartRequest['workflow']>(
            payload.workflowCompressed, payload.workflow as AnalysisStartRequest['workflow']);
        request.nestedPlugins = await readMaybeCompressed<AnalysisStartRequest['nestedPlugins']>(
            payload.nestedPluginsCompressed, payload.nestedPlugins ?? []);
        request.pluginReferenceExecutions = await readMaybeCompressed<AnalysisStartRequest['pluginReferenceExecutions']>(
            payload.pluginReferenceExecutionsCompressed, payload.pluginReferenceExecutions ?? []);

        const traceContext = extractDaemonTraceContext(payload as unknown as Record<string, unknown>);
        if (traceContext) {
            request.traceContext = traceContext;
        }

        return request;
    }
}
