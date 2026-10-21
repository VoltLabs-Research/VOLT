import { getDebugSessionManager } from '@modules/analysis/services/workflow/debug/DebugSessionManager';
import { Command, commandGroupFactory } from '@shared/commands/command';
import type { DebugSessionManager } from '@modules/analysis/services/workflow/debug/DebugSessionManager';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import type {
    DebugStartRequest,
    DebugStartResult,
    DebugSessionRequest,
    DebugStepResult,
    DebugContinueResult,
    DebugStopResult
} from '@volt/contracts/modules/plugin/debug';

export class DebugCommands {
    constructor(private readonly debugSessionManager: DebugSessionManager) {}

    @Command(DaemonCommand.DebugStart)
    async start(payload: DebugStartRequest): Promise<DebugStartResult> {
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

    @Command(DaemonCommand.DebugStep)
    async step(payload: DebugSessionRequest): Promise<DebugStepResult> {
        const result = await this.debugSessionManager.executeCurrentNode(payload.sessionId);
        const nextNode = this.debugSessionManager.getCurrentNodeInfo(payload.sessionId);

        return {
            result,
            nextNode,
            hasMore: nextNode !== null
        };
    }

    @Command(DaemonCommand.DebugContinue)
    async continueExecution(payload: DebugSessionRequest): Promise<DebugContinueResult> {
        return {
            results: await this.debugSessionManager.executeAllRemaining(payload.sessionId)
        };
    }

    @Command(DaemonCommand.DebugStop)
    stop(payload: DebugSessionRequest): DebugStopResult {
        this.debugSessionManager.destroySession(payload.sessionId);
        return { stopped: true };
    }
}

export const getDebugCommands = commandGroupFactory(DebugCommands, () => new DebugCommands(getDebugSessionManager()));
