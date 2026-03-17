import type { DebugSessionManager } from '@/modules/workflow-runtime/services';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readNumber,
    readOptionalNumber,
    readOptionalRecord,
    readPayloadRecord,
    readRecord,
    readString
} from './payloadValidation';
import type { WorkflowDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition } from '@/shared/contracts';

interface DebugHandlersDependencies {
    debugSessionManager: DebugSessionManager;
}

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

const readTrajectoryFrames = (value: unknown): Array<{ timestep: number; natoms: number; simulationCell: string }> => {
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

export const createDebugHandlers = (deps: DebugHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'debug.start',
        execute: async (payload) => {
            const record = readPayloadRecord(payload);
            const workflow = readWorkflowDefinition(record.workflow);
            const trajectoryFrames = readTrajectoryFrames(record.trajectoryFrames);
            const pluginId = readString(record.pluginId, 'pluginId');
            const teamId = readString(record.teamId, 'teamId');
            const trajectoryId = readString(record.trajectoryId, 'trajectoryId');
            const userConfig = readOptionalRecord(record.config) ?? {};
            const timestep = readOptionalNumber(record.timestep);

            const sessionInfo = deps.debugSessionManager.createSession({
                workflow,
                trajectoryId,
                trajectoryFrames,
                pluginId,
                teamId,
                userConfig,
                timestep
            });

            // Get the first node info so the server can emit node:started immediately
            const firstNode = deps.debugSessionManager.getCurrentNodeInfo(sessionInfo.sessionId);

            return {
                data: {
                    ...sessionInfo,
                    firstNode
                }
            };
        }
    },
    {
        command: 'debug.step',
        execute: async (payload) => {
            const record = readPayloadRecord(payload);
            const sessionId = readString(record.sessionId, 'sessionId');

            const result = await deps.debugSessionManager.executeCurrentNode(sessionId);
            const nextNode = deps.debugSessionManager.getCurrentNodeInfo(sessionId);
            const hasMore = deps.debugSessionManager.hasMoreNodes(sessionId);

            return {
                data: {
                    result,
                    nextNode,
                    hasMore
                }
            };
        }
    },
    {
        command: 'debug.continue',
        execute: async (payload) => {
            const record = readPayloadRecord(payload);
            const sessionId = readString(record.sessionId, 'sessionId');

            const results = await deps.debugSessionManager.executeAllRemaining(sessionId);

            return {
                data: {
                    results
                }
            };
        }
    },
    {
        command: 'debug.stop',
        execute: async (payload) => {
            const record = readPayloadRecord(payload);
            const sessionId = readString(record.sessionId, 'sessionId');

            deps.debugSessionManager.destroySession(sessionId);

            return {
                data: { stopped: true }
            };
        }
    }
];
