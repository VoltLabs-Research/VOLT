import type { DebugSessionManager } from '@/modules/workflow-runtime/services';
import type { ReverseChannelCommandHandler } from '../services';
import {
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

            const sessionInfo = deps.debugSessionManager.createSession({
                workflow,
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
