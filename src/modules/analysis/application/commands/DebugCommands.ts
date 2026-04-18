import type { NestedPluginDefinition, TrajectoryFrame, WorkflowDefinition } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type { DebugSessionManager } from '@/modules/analysis/application/workflow/debug/DebugSessionManager';

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

interface DebugSessionPayload {
    sessionId: string;
}

@CommandGroup('debug')
export class DebugCommands {
    constructor(private readonly debugSessionManager: DebugSessionManager) {}

    @Command('start')
    async start(payload: DebugStartPayload) {
        const sessionInfo = this.debugSessionManager.createSession({
            workflow: payload.workflow,
            nestedPlugins: payload.nestedPlugins ?? [],
            trajectoryId: payload.trajectoryId,
            trajectoryFrames: payload.trajectoryFrames,
            pluginId: payload.pluginId,
            teamId: payload.teamId,
            userConfig: payload.config ?? {},
            storageClusterId: payload.storageClusterId,
            timestep: payload.timestep
        });
        const firstNode = this.debugSessionManager.getCurrentNodeInfo(sessionInfo.sessionId);

        return {
            ...sessionInfo,
            firstNode
        };
    }

    @Command('step')
    async step(payload: DebugSessionPayload) {
        const result = await this.debugSessionManager.executeCurrentNode(payload.sessionId);
        const nextNode = this.debugSessionManager.getCurrentNodeInfo(payload.sessionId);
        const hasMore = this.debugSessionManager.hasMoreNodes(payload.sessionId);

        return {
            result,
            nextNode,
            hasMore
        };
    }

    @Command('continue')
    async continueExecution(payload: DebugSessionPayload) {
        return {
            results: await this.debugSessionManager.executeAllRemaining(payload.sessionId)
        };
    }

    @Command('stop')
    stop(payload: DebugSessionPayload) {
        this.debugSessionManager.destroySession(payload.sessionId);
        return { stopped: true };
    }
}
