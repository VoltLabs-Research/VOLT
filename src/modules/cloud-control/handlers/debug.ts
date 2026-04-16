import type { DebugSessionManager } from '@/modules/workflow-runtime/services';
import type {
    NestedPluginDefinition,
    TrajectoryFrame,
    WorkflowDefinition
} from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';

interface DebugHandlersDependencies {
    debugSessionManager: DebugSessionManager;
}

interface DebugStartPayload {
    workflow: WorkflowDefinition;
    trajectoryFrames: TrajectoryFrame[];
    pluginId: string;
    teamId: string;
    trajectoryId: string;
    config?: Record<string, unknown>;
    timestep?: number;
    storageClusterId?: string;
    nestedPlugins?: NestedPluginDefinition[];
}

export const createDebugHandlers = (deps: DebugHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'debug.start',
        execute: async (payload) => {
            const request = payload as DebugStartPayload;

            const sessionInfo = deps.debugSessionManager.createSession({
                workflow: request.workflow,
                nestedPlugins: request.nestedPlugins ?? [],
                trajectoryId: request.trajectoryId,
                trajectoryFrames: request.trajectoryFrames,
                pluginId: request.pluginId,
                teamId: request.teamId,
                userConfig: request.config ?? {},
                storageClusterId: request.storageClusterId,
                timestep: request.timestep
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
            const { sessionId } = payload as { sessionId: string };

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
            const { sessionId } = payload as { sessionId: string };

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
            const { sessionId } = payload as { sessionId: string };

            deps.debugSessionManager.destroySession(sessionId);

            return {
                data: { stopped: true }
            };
        }
    }
];
