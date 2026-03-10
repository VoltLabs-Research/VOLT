import type { AnalysisStartRequest, WorkflowDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition } from '@/shared/contracts';
import type { AnalysisDispatchService } from '@/modules/job-runtime/services';
import type { ReverseChannelCommandHandler } from '../services';
import { readNumber, readOptionalBoolean, readOptionalNumber, readPayloadRecord, readRecord, readString } from './payloadValidation';

interface AnalysisHandlersDependencies {
    analysisDispatchService: AnalysisDispatchService;
};

interface AnalysisTrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
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
    const timestep = readOptionalNumber(record.timestep);

    if (typeof selectedFrameOnly !== 'undefined') {
        request.selectedFrameOnly = selectedFrameOnly;
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
