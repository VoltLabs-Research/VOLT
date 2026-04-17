import type { AnalysisStartRequest, AnalysisStartTransportRequest } from '@/contracts';
import { ChannelCommands } from '@/contracts';
import type { AnalysisDispatchService } from '@/modules/analysis/application/dispatch/AnalysisDispatchService';
import { extractDaemonTraceContext } from '@/core/observability/infrastructure/daemonInstrumentation';
import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';
import type { DaemonTraceContext } from '@/core/observability/infrastructure/daemonInstrumentation';
import type { RuntimeCapabilityGuard } from '@/core/runtime/application/RuntimeCapabilityGuard';
import zlib from 'node:zlib';

interface AnalysisHandlersDependencies {
    analysisDispatchService: AnalysisDispatchService;
    runtimeCapabilityGuard: RuntimeCapabilityGuard;
};

interface AnalysisStartRequestWithTrace extends AnalysisStartRequest {
    traceContext?: DaemonTraceContext;
};

interface AnalysisStartTransportPayload extends AnalysisStartTransportRequest {
    traceContext?: DaemonTraceContext;
}

const readCompressedJson = <T>(value: string): T => {
    return JSON.parse(zlib.gunzipSync(Buffer.from(value, 'base64')).toString('utf8')) as T;
};

const readAnalysisStartRequest = (payload: unknown): AnalysisStartRequestWithTrace => {
    const transport = payload as AnalysisStartTransportPayload;
    const request = { ...transport } as AnalysisStartRequestWithTrace;

    request.trajectoryFrames = typeof transport.trajectoryFramesCompressed === 'string'
        ? readCompressedJson<AnalysisStartRequest['trajectoryFrames']>(transport.trajectoryFramesCompressed)
        : transport.trajectoryFrames ?? [];
    request.workflow = typeof transport.workflowCompressed === 'string'
        ? readCompressedJson<AnalysisStartRequest['workflow']>(transport.workflowCompressed)
        : transport.workflow as AnalysisStartRequest['workflow'];
    request.nestedPlugins = typeof transport.nestedPluginsCompressed === 'string'
        ? readCompressedJson<AnalysisStartRequest['nestedPlugins']>(transport.nestedPluginsCompressed)
        : transport.nestedPlugins ?? [];
    request.pluginReferenceExecutions = typeof transport.pluginReferenceExecutionsCompressed === 'string'
        ? readCompressedJson<AnalysisStartRequest['pluginReferenceExecutions']>(transport.pluginReferenceExecutionsCompressed)
        : transport.pluginReferenceExecutions ?? [];

    const traceContext = extractDaemonTraceContext(transport as unknown as Record<string, unknown>);
    if (traceContext) {
        request.traceContext = traceContext;
    }

    return request;
};

export const createAnalysisHandlers = (deps: AnalysisHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: ChannelCommands.AnalysisStart,
        execute: async (payload) => {
            deps.runtimeCapabilityGuard.ensureAcceptsComputeJobs(
                ChannelCommands.AnalysisStart
            );
            const request = readAnalysisStartRequest(payload);
            return { data: await deps.analysisDispatchService.startAnalysis(request) };
        }
    }
];
