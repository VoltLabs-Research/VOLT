import type {
    AnalysisStartRequest,
    DaemonAnalysisDocument,
    WorkflowDefinition,
    WorkflowEdgeDefinition,
    WorkflowNodeDefinition
} from '@/shared/contracts';
import type { AnalysisDispatchService } from '@/modules/job-runtime/services';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readNumber,
    readOptionalBoolean,
    readOptionalNumber,
    readOptionalNumberArray,
    readPayloadRecord,
    readRecord,
    readString
} from './payloadValidation';
import { readDocumentId, toRecord } from '@/shared/utils';

interface AnalysisHandlersDependencies {
    analysisDispatchService: AnalysisDispatchService;
};

interface AnalysisTrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

const readAnalysisDocument = (value: unknown): DaemonAnalysisDocument => {
    const record = readRecord(value, 'analysis');
    const analysis: DaemonAnalysisDocument = {
        _id: readDocumentId(record._id)
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

const readWorkflowNodeDefinition = (value: unknown): WorkflowNodeDefinition => {
    const record = readRecord(value, 'workflow.nodes');
    const position = readRecord(record.position, 'workflow.nodes.position');

    return {
        id: readString(record.id, 'workflow.nodes.id'),
        type: readString(record.type, 'workflow.nodes.type'),
        position: {
            x: readNumber(position.x, 'workflow.nodes.position.x'),
            y: readNumber(position.y, 'workflow.nodes.position.y')
        },
        data: readRecord(record.data, 'workflow.nodes.data')
    };
};

const readWorkflowEdgeDefinition = (value: unknown): WorkflowEdgeDefinition => {
    const record = readRecord(value, 'workflow.edges');
    const edge: WorkflowEdgeDefinition = {
        source: readString(record.source, 'workflow.edges.source'),
        target: readString(record.target, 'workflow.edges.target')
    };

    if (typeof record.sourceHandle !== 'undefined') {
        edge.sourceHandle = readString(record.sourceHandle, 'workflow.edges.sourceHandle');
    }

    if (typeof record.targetHandle !== 'undefined') {
        edge.targetHandle = readString(record.targetHandle, 'workflow.edges.targetHandle');
    }

    return edge;
};

const readWorkflowDefinition = (value: unknown): WorkflowDefinition => {
    const record = readRecord(value, 'workflow');
    const nodesValue = record.nodes;
    const edgesValue = record.edges;

    if (!Array.isArray(nodesValue)) {
        throw new Error('workflow.nodes must be an array');
    }

    if (!Array.isArray(edgesValue)) {
        throw new Error('workflow.edges must be an array');
    }

    return {
        nodes: nodesValue.map(readWorkflowNodeDefinition),
        edges: edgesValue.map(readWorkflowEdgeDefinition)
    };
};

const readAnalysisTrajectoryFrames = (value: unknown): AnalysisTrajectoryFrame[] => {
    if (!Array.isArray(value)) {
        throw new Error('trajectoryFrames must be an array');
    }

    return value.map((entry) => {
        const record = readRecord(entry, 'trajectoryFrames');

        return {
            timestep: readNumber(record.timestep, 'trajectoryFrames.timestep'),
            natoms: readNumber(record.natoms, 'trajectoryFrames.natoms'),
            simulationCell: readString(record.simulationCell, 'trajectoryFrames.simulationCell')
        };
    });
};

const readAnalysisStartRequest = (payload: unknown): AnalysisStartRequest => {
    const record = readPayloadRecord(payload);
    const request: AnalysisStartRequest = {
        analysis: readAnalysisDocument(record.analysis),
        analysisId: readString(record.analysisId, 'analysisId'),
        pluginId: readString(record.pluginId, 'pluginId'),
        teamId: readString(record.teamId, 'teamId'),
        teamClusterId: readString(record.teamClusterId, 'teamClusterId'),
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        trajectoryFrames: readAnalysisTrajectoryFrames(record.trajectoryFrames),
        workflow: readWorkflowDefinition(record.workflow),
        config: readRecord(record.config, 'config')
    };
    const selectedFrameOnly = typeof record.selectedFrameOnly === 'undefined'
        ? undefined
        : readOptionalBoolean(record.selectedFrameOnly, false);
    const selectedTimesteps = readOptionalNumberArray(record.selectedTimesteps, 'selectedTimesteps');
    const timestep = readOptionalNumber(record.timestep);

    if (typeof selectedFrameOnly !== 'undefined') {
        request.selectedFrameOnly = selectedFrameOnly;
    }

    if (selectedTimesteps?.length) {
        request.selectedTimesteps = selectedTimesteps;
    }

    if (typeof timestep !== 'undefined') {
        request.timestep = timestep;
    }

    return request;
};

export const createAnalysisHandlers = (deps: AnalysisHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'analysis.start',
        execute: async (payload) => {
            const request = readAnalysisStartRequest(payload);
            return { data: await deps.analysisDispatchService.startAnalysis(request) };
        }
    }
];
