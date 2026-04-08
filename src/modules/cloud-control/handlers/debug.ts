import type { DebugSessionManager } from '@/modules/workflow-runtime/services';
import type { NestedPluginDefinition, PluginReferenceExecutionRequest } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readRecord,
    readOptionalNumber,
    readOptionalRecord,
    readOptionalString,
    readPayloadRecord,
    readString,
    readTrajectoryFrames,
    readWorkflowDefinition
} from './payloadValidation';

interface DebugHandlersDependencies {
    debugSessionManager: DebugSessionManager;
}

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
            const storageClusterId = readOptionalString(record.storageClusterId, '');
            const nestedPlugins = readOptionalArray(
                record.nestedPlugins,
                'nestedPlugins',
                readNestedPluginDefinition
            );
            const pluginReferenceExecutions = readOptionalArray(
                record.pluginReferenceExecutions,
                'pluginReferenceExecutions',
                readPluginReferenceExecutionRequest
            );

            const sessionInfo = deps.debugSessionManager.createSession({
                workflow,
                nestedPlugins,
                pluginReferenceExecutions,
                trajectoryId,
                trajectoryFrames,
                pluginId,
                teamId,
                userConfig,
                storageClusterId: storageClusterId || undefined,
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
