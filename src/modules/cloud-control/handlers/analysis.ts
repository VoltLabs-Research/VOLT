import type {
    AnalysisStartRequest,
    DaemonAnalysisDocument,
    NestedPluginDefinition,
    PluginReferenceExecutionRequest
} from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { AnalysisDispatchService } from '@/modules/job-runtime/services';
import { extractDaemonTraceContext } from '@/shared/observability/daemonInstrumentation';
import type { ReverseChannelCommandHandler } from '../services';
import type { DaemonTraceContext } from '@/shared/observability/daemonInstrumentation';
import zlib from 'node:zlib';
import {
    readOptionalBoolean,
    readOptionalNumber,
    readOptionalNumberArray,
    readPayloadRecord,
    readRecord,
    readString,
    readTrajectoryFrames,
    readWorkflowDefinition
} from './payloadValidation';
import { readDocumentId, toRecord } from '@/shared/utils';

interface AnalysisHandlersDependencies {
    analysisDispatchService: AnalysisDispatchService;
};

interface AnalysisStartRequestWithTrace extends AnalysisStartRequest {
    traceContext?: DaemonTraceContext;
};

const readCompressedJson = (value: unknown, fieldName: string): unknown => {
    const encodedValue = readString(value, fieldName);
    const compressedBuffer = Buffer.from(encodedValue, 'base64');
    return JSON.parse(zlib.gunzipSync(compressedBuffer).toString('utf8'));
};

const readCompressedOrRawValue = (record: Record<string, unknown>, rawField: string, compressedField: string): unknown => {
    if (typeof record[compressedField] === 'string') {
        return readCompressedJson(record[compressedField], compressedField);
    }

    return record[rawField];
};

const readOptionalArray = <T>(
    value: unknown,
    fieldName: string,
    readEntry: (entry: unknown) => T
): T[] => {
    if (typeof value === 'undefined') {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    return value.map(readEntry);
};

const readAnalysisDocument = (value: unknown): DaemonAnalysisDocument => {
    const record = readRecord(value, 'analysis');
    const analysis: DaemonAnalysisDocument = {
        _id: readDocumentId(record._id),
        pluginDisplayName: readString(record.pluginDisplayName, 'analysis.pluginDisplayName')
    };

    if (!analysis._id) {
        throw new Error('analysis._id is required');
    }

    if (typeof record.plugin === 'string') {
        analysis.plugin = record.plugin;
    }

    if (typeof record.clusterId === 'string') {
        analysis.clusterId = record.clusterId;
    }

    if (typeof record.teamCluster === 'string') {
        analysis.teamCluster = record.teamCluster;
    }

    if (typeof record.config !== 'undefined') {
        analysis.config = toRecord(record.config);
    }

    if (typeof record.trajectory === 'string') {
        analysis.trajectory = record.trajectory;
    }

    if (typeof record.createdBy === 'string') {
        analysis.createdBy = record.createdBy;
    }

    if (typeof record.totalFrames === 'number') {
        analysis.totalFrames = record.totalFrames;
    }

    if (typeof record.completedFrames === 'number') {
        analysis.completedFrames = record.completedFrames;
    }

    if (typeof record.startedAt === 'string' || record.startedAt instanceof Date) {
        analysis.startedAt = record.startedAt;
    }

    if (typeof record.finishedAt === 'string' || record.finishedAt instanceof Date) {
        analysis.finishedAt = record.finishedAt;
    }

    if (typeof record.team === 'string') {
        analysis.team = record.team;
    }

    if (typeof record.status === 'string') {
        analysis.status = record.status;
    }

    if (typeof record.createdAt === 'string' || record.createdAt instanceof Date) {
        analysis.createdAt = record.createdAt;
    }

    if (typeof record.updatedAt === 'string' || record.updatedAt instanceof Date) {
        analysis.updatedAt = record.updatedAt;
    }

    return analysis;
};

const readNestedPluginDefinition = (value: unknown): NestedPluginDefinition => {
    const record = readRecord(value, 'nestedPlugins');

    return {
        pluginId: readString(record.pluginId, 'nestedPlugins.pluginId'),
        workflow: readWorkflowDefinition(record.workflow)
    };
};

const readPluginReferenceExecutionRequest = (value: unknown): PluginReferenceExecutionRequest => {
    const record = readRecord(value, 'pluginReferenceExecutions');

    return {
        referencePath: readString(record.referencePath, 'pluginReferenceExecutions.referencePath'),
        pluginId: readString(record.pluginId, 'pluginReferenceExecutions.pluginId'),
        config: readRecord(record.config, 'pluginReferenceExecutions.config')
    };
};

const readAnalysisStartRequest = (payload: unknown): AnalysisStartRequestWithTrace => {
    const record = readPayloadRecord(payload);
    const pluginDisplayName = readString(record.pluginDisplayName, 'pluginDisplayName');
    const rawTrajectoryFrames = readCompressedOrRawValue(record, 'trajectoryFrames', 'trajectoryFramesCompressed');
    const rawWorkflow = readCompressedOrRawValue(record, 'workflow', 'workflowCompressed');
    const rawNestedPlugins = readCompressedOrRawValue(record, 'nestedPlugins', 'nestedPluginsCompressed');
    const rawPluginReferenceExecutions = readCompressedOrRawValue(
        record,
        'pluginReferenceExecutions',
        'pluginReferenceExecutionsCompressed'
    );
    const request: AnalysisStartRequestWithTrace = {
        analysis: readAnalysisDocument(record.analysis),
        analysisId: readString(record.analysisId, 'analysisId'),
        pluginId: readString(record.pluginId, 'pluginId'),
        pluginDisplayName,
        teamId: readString(record.teamId, 'teamId'),
        teamClusterId: readString(record.teamClusterId, 'teamClusterId'),
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        trajectoryFrames: readTrajectoryFrames(rawTrajectoryFrames),
        workflow: readWorkflowDefinition(rawWorkflow),
        nestedPlugins: readOptionalArray(rawNestedPlugins, 'nestedPlugins', readNestedPluginDefinition),
        pluginReferenceExecutions: readOptionalArray(
            rawPluginReferenceExecutions,
            'pluginReferenceExecutions',
            readPluginReferenceExecutionRequest
        ),
        config: readRecord(record.config, 'config')
    };
    const selectedFrameOnly = typeof record.selectedFrameOnly === 'undefined'
        ? undefined
        : readOptionalBoolean(record.selectedFrameOnly, false);
    const selectedTimesteps = readOptionalNumberArray(record.selectedTimesteps, 'selectedTimesteps');
    const timestep = readOptionalNumber(record.timestep);
    const trajectoryName = typeof record.trajectoryName === 'string'
        ? record.trajectoryName
        : undefined;

    if (typeof selectedFrameOnly !== 'undefined') {
        request.selectedFrameOnly = selectedFrameOnly;
    }

    if (selectedTimesteps?.length) {
        request.selectedTimesteps = selectedTimesteps;
    }

    if (typeof timestep !== 'undefined') {
        request.timestep = timestep;
    }

    if (typeof trajectoryName !== 'undefined') {
        request.trajectoryName = trajectoryName;
    }

    const traceContext = extractDaemonTraceContext(record);
    if (traceContext) {
        request.traceContext = traceContext;
    }

    return request;
};

export const createAnalysisHandlers = (deps: AnalysisHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.analysis.start,
        execute: async (payload) => {
            const request = readAnalysisStartRequest(payload);
            return { data: await deps.analysisDispatchService.startAnalysis(request) };
        }
    }
];
