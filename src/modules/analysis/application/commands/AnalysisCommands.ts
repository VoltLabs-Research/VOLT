import zlib from 'node:zlib';
import type { AnalysisStartRequest, AnalysisStartTransportRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import { extractDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import type { DaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import type { AnalysisDispatcher } from '@/modules/analysis/application/analysis/AnalysisDispatcher';

interface AnalysisStartRequestWithTrace extends AnalysisStartRequest {
    traceContext?: DaemonTraceContext;
}

interface AnalysisStartTransportPayload extends AnalysisStartTransportRequest {
    traceContext?: DaemonTraceContext;
}

@CommandGroup('analysis')
export class AnalysisCommands {
    constructor(
        private readonly analysisDispatcher: AnalysisDispatcher
    ) {}

    @Command('start')
    async start(payload: AnalysisStartTransportPayload) {
        return this.analysisDispatcher.startAnalysis(this.readAnalysisStartRequest(payload));
    }

    private readAnalysisStartRequest(payload: AnalysisStartTransportPayload): AnalysisStartRequestWithTrace {
        const request = { ...payload } as AnalysisStartRequestWithTrace;

        request.trajectoryFrames = typeof payload.trajectoryFramesCompressed === 'string'
            ? this.readCompressedJson<AnalysisStartRequest['trajectoryFrames']>(payload.trajectoryFramesCompressed)
            : payload.trajectoryFrames ?? [];
        request.workflow = typeof payload.workflowCompressed === 'string'
            ? this.readCompressedJson<AnalysisStartRequest['workflow']>(payload.workflowCompressed)
            : payload.workflow as AnalysisStartRequest['workflow'];
        request.nestedPlugins = typeof payload.nestedPluginsCompressed === 'string'
            ? this.readCompressedJson<AnalysisStartRequest['nestedPlugins']>(payload.nestedPluginsCompressed)
            : payload.nestedPlugins ?? [];
        request.pluginReferenceExecutions = typeof payload.pluginReferenceExecutionsCompressed === 'string'
            ? this.readCompressedJson<AnalysisStartRequest['pluginReferenceExecutions']>(payload.pluginReferenceExecutionsCompressed)
            : payload.pluginReferenceExecutions ?? [];

        const traceContext = extractDaemonTraceContext(payload as unknown as Record<string, unknown>);
        if (traceContext) {
            request.traceContext = traceContext;
        }

        return request;
    }

    private readCompressedJson<T>(value: string): T {
        return JSON.parse(zlib.gunzipSync(Buffer.from(value, 'base64')).toString('utf8')) as T;
    }
}
