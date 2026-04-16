import type {
    AnalysisStartRequest,
    AnalysisStartTransportRequest
} from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { AnalysisDispatchService } from '@/modules/job-runtime/services';
import { extractDaemonTraceContext } from '@/shared/observability/daemonInstrumentation';
import type { ReverseChannelCommandHandler } from '../services';
import type { DaemonTraceContext } from '@/shared/observability/daemonInstrumentation';
import type { RuntimeCapabilityGuard } from '../services';
import { DaemonCommandError } from '../services/DaemonCommandError';
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

const readCompressedJson = (value: unknown, fieldName: string): unknown => {
    try {
        const encodedValue = value as string;
        const compressedBuffer = Buffer.from(encodedValue, 'base64');
        return JSON.parse(zlib.gunzipSync(compressedBuffer).toString('utf8'));
    } catch {
        throw DaemonCommandError.badRequest(
            'Analysis::Start::InvalidCompressedPayload',
            `${fieldName} must be valid gzip-compressed JSON`
        );
    }
};

const readAnalysisStartRequest = (payload: unknown): AnalysisStartRequestWithTrace => {
    const transport = payload as AnalysisStartTransportPayload;
    const request = { ...transport } as AnalysisStartRequestWithTrace;

    request.trajectoryFrames = typeof transport.trajectoryFramesCompressed === 'string'
        ? readCompressedJson(transport.trajectoryFramesCompressed, 'trajectoryFramesCompressed') as AnalysisStartRequest['trajectoryFrames']
        : transport.trajectoryFrames ?? [];
    request.workflow = typeof transport.workflowCompressed === 'string'
        ? readCompressedJson(transport.workflowCompressed, 'workflowCompressed') as AnalysisStartRequest['workflow']
        : transport.workflow as AnalysisStartRequest['workflow'];
    request.nestedPlugins = typeof transport.nestedPluginsCompressed === 'string'
        ? readCompressedJson(transport.nestedPluginsCompressed, 'nestedPluginsCompressed') as AnalysisStartRequest['nestedPlugins']
        : transport.nestedPlugins ?? [];
    request.pluginReferenceExecutions = typeof transport.pluginReferenceExecutionsCompressed === 'string'
        ? readCompressedJson(transport.pluginReferenceExecutionsCompressed, 'pluginReferenceExecutionsCompressed') as AnalysisStartRequest['pluginReferenceExecutions']
        : transport.pluginReferenceExecutions ?? [];

    const traceContext = extractDaemonTraceContext(transport as unknown as Record<string, unknown>);
    if (traceContext) {
        request.traceContext = traceContext;
    }

    return request;
};

export const createAnalysisHandlers = (deps: AnalysisHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.analysis.start,
        execute: async (payload) => {
            deps.runtimeCapabilityGuard.ensureAcceptsComputeJobs(
                TEAM_CLUSTER_DAEMON_COMMAND.analysis.start
            );
            let request: AnalysisStartRequestWithTrace;

            try {
                request = readAnalysisStartRequest(payload);
            } catch (error: unknown) {
                if (error instanceof DaemonCommandError) {
                    throw error;
                }

                throw DaemonCommandError.badRequest(
                    'Analysis::Start::InvalidRequest',
                    error instanceof Error ? error.message : 'Invalid analysis.start payload'
                );
            }

            return { data: await deps.analysisDispatchService.startAnalysis(request) };
        }
    }
];
