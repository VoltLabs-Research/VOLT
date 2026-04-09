import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@shared/infrastructure/contracts/team-cluster';
import { PluginDependencyResolverService } from '@modules/plugin/infrastructure/services/plugin/PluginDependencyResolverService';
import PluginDebugSessionRegistryService from '@modules/plugin/infrastructure/services/PluginDebugSessionRegistryService';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import Workflow, { type WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import type { PluginReferenceExecutionRequest } from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import type {
    IWorkflowValidatorService
} from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import {
    WorkflowValidationMode
} from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';

// --- Payload types from the client ---

interface DebugStartPayload {
    pluginId: string;
    trajectoryId: string;
    timestep: number;
    config: Record<string, unknown>;
    workflow?: WorkflowProps;
}

interface DebugSessionPayload {
    sessionId: string;
}

// --- Response types from the daemon ---

interface DaemonDebugNodeResult {
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'skipped' | 'error';
    output?: Record<string, unknown>;
    error?: string;
    stack?: string;
    reason?: string;
    nestedTrace?: DebugTraceNode[];
    durationMs: number;
    contextSnapshot: Record<string, Record<string, unknown>>;
}

interface DebugTraceNode {
    traceId: string;
    nodeId: string;
    nodeType: string;
    status: 'completed' | 'skipped' | 'error';
    durationMs: number;
    output?: Record<string, unknown>;
    reason?: string;
    error?: string;
    stack?: string;
    pluginId?: string;
    label?: string;
    children?: DebugTraceNode[];
}

interface DaemonDebugStartResponse {
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
    firstNode: { nodeId: string; nodeType: string; index: number; total: number } | null;
}

interface NestedPluginDefinition {
    pluginId: string;
    workflow: {
        nodes: Array<{
            id: string;
            type: string;
            position: { x: number; y: number; };
            data: Record<string, unknown>;
        }>;
        edges: Array<{
            id?: string;
            source: string;
            target: string;
            sourceHandle?: string;
            targetHandle?: string;
        }>;
    };
}

interface DaemonDebugStepResponse {
    result: DaemonDebugNodeResult | null;
    nextNode: { nodeId: string; nodeType: string; index: number; total: number } | null;
    hasMore: boolean;
}

interface DaemonDebugContinueResponse {
    results: DaemonDebugNodeResult[];
}

const buildNestedPluginDefinition = (plugin: Plugin): NestedPluginDefinition => ({
    pluginId: plugin.id,
    workflow: plugin.props.workflow.props as NestedPluginDefinition['workflow']
});

const createRuntimePlugin = (plugin: Plugin, workflow: WorkflowProps): Plugin => new Plugin(plugin.id, {
    ...plugin.props,
    workflow: new Workflow(plugin.id, workflow),
    status: plugin.props.status ?? PluginStatus.Draft
});

@injectable()
export default class PluginDebugSocketModule extends BaseSocketModule {
    public readonly name = 'PluginDebugSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly daemonClient: TeamClusterDaemonClient,
        @inject(SOCKET_TOKENS.TeamSubscriptionCoordinator)
        private readonly teamSubscriptionCoordinator: SocketTeamSubscriptionCoordinator,
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService,
        @inject(PLUGIN_TOKENS.PluginDebugSessionRegistryService)
        private readonly pluginDebugSessionRegistry: PluginDebugSessionRegistryService,
        @inject(PLUGIN_TOKENS.PluginDependencyResolverService)
        private readonly pluginDependencyResolverService: PluginDependencyResolverService,
        @inject(PLUGIN_TOKENS.WorkflowValidatorService)
        private readonly workflowValidator: IWorkflowValidatorService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.registerDebugStart(connection);
        this.registerDebugStep(connection);
        this.registerDebugContinue(connection);
        this.registerDebugStop(connection);

        this.onDisconnect(connection.id, () => {
            this.cleanupSessionsForSocket(connection.id);
        });
    }

    async onShutdown(): Promise<void> {
        // Best-effort cleanup of all active sessions
        for (const [sessionId, entry] of this.pluginDebugSessionRegistry.listSessions()) {
            try {
                await this.daemonClient.command(entry.teamClusterId, 'debug.stop', { sessionId });
            } catch {
                // Ignore errors during shutdown
            }
        }
    }

    // --- debug:start ---

    private registerDebugStart(connection: ISocketConnection): void {
        this.on<DebugStartPayload>(connection.id, 'debug:start', async (conn, payload) => {
            try {
                const teamId = this.teamSubscriptionCoordinator.getCurrentTeamId(conn);
                if (!teamId) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: 'No team selected'
                    });
                    return;
                }

                const teamClusterId = await this.teamClusterSelectionService.resolveComputeClusterId(teamId);

                // Load plugin to get workflow
                const plugin = await this.pluginRepository.findById(payload.pluginId);
                if (!plugin) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: 'Plugin not found'
                    });
                    return;
                }
                const workflow = payload.workflow ?? plugin.props.workflow.props;
                const workflowValidation = await this.workflowValidator.validate(
                    workflow,
                    plugin.id,
                    WorkflowValidationMode.Strict
                );
                if (!workflowValidation.isValid) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: workflowValidation.errors?.join('; ') || 'Workflow validation failed'
                    });
                    return;
                }
                const runtimePlugin = createRuntimePlugin(plugin, workflow);

                // Load trajectory to get frames
                const trajectory = await this.trajectoryRepository.findById(payload.trajectoryId);
                if (!trajectory) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: 'Trajectory not found'
                    });
                    return;
                }
                const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props)
                    ?? VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID;
                const pluginReferenceExecutions = this.pluginDependencyResolverService.getArgumentPluginReferenceExecutions(
                    runtimePlugin,
                    payload.config ?? {}
                );
                const dependencyResolution = await this.pluginDependencyResolverService.collectTransitivePublishedDependencies(runtimePlugin);
                if (dependencyResolution.errors.length > 0) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: dependencyResolution.errors.join('; ')
                    });
                    return;
                }

                const runtimePluginIds = Array.from(new Set(pluginReferenceExecutions.map((reference) => reference.pluginId)));
                const runtimePlugins = runtimePluginIds.length > 0
                    ? await this.pluginRepository.findByIds(runtimePluginIds)
                    : [];
                const runtimeDependencyResolution = await this.pluginDependencyResolverService.collectTransitivePublishedDependenciesForPlugins(
                    runtimePlugins
                );
                if (runtimeDependencyResolution.errors.length > 0) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: runtimeDependencyResolution.errors.join('; ')
                    });
                    return;
                }
                const nestedPlugins = Array.from(new Map(
                    [...dependencyResolution.dependencies, ...runtimePlugins]
                        .concat(runtimeDependencyResolution.dependencies)
                        .map((candidate) => [candidate.id, candidate])
                ).values()).map(buildNestedPluginDefinition);

                // Send debug.start command to daemon
                const response = await this.daemonClient.command<DaemonDebugStartResponse>(
                    teamClusterId,
                    'debug.start',
                    {
                        workflow,
                        trajectoryId: payload.trajectoryId,
                        trajectoryFrames: trajectory.props.frames,
                        pluginId: payload.pluginId,
                        teamId,
                        storageClusterId,
                        nestedPlugins,
                        pluginReferenceExecutions: pluginReferenceExecutions as PluginReferenceExecutionRequest[],
                        config: payload.config ?? {},
                        timestep: payload.timestep
                    }
                );

                // Track session
                this.pluginDebugSessionRegistry.registerSession(response.sessionId, {
                    socketId: conn.id,
                    teamClusterId
                });

                // Emit session:created to client
                this.emitToSocket(conn.id, 'debug:session:created', {
                    sessionId: response.sessionId,
                    executionOrder: response.executionOrder,
                    forEachNodeId: response.forEachNodeId,
                    totalIterations: response.totalIterations
                });

                // Emit node:started for the first node
                if (response.firstNode) {
                    this.emitToSocket(conn.id, 'debug:node:started', {
                        sessionId: response.sessionId,
                        nodeId: response.firstNode.nodeId,
                        nodeType: response.firstNode.nodeType,
                        index: response.firstNode.index,
                        total: response.firstNode.total
                    });
                }

                logger.info(`@plugin-debug-socket: session ${response.sessionId} created for plugin ${payload.pluginId}`);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Failed to start debug session';
                logger.error({ err: error }, '@plugin-debug-socket: debug:start failed');
                this.emitToSocket(conn.id, 'debug:session:error', { error: message });
            }
        });
    }

    // --- debug:step ---

    private registerDebugStep(connection: ISocketConnection): void {
        this.on<DebugSessionPayload>(connection.id, 'debug:step', async (conn, payload) => {
            const entry = this.pluginDebugSessionRegistry.getSession(payload.sessionId);
            if (!entry || entry.socketId !== conn.id) {
                this.emitToSocket(conn.id, 'debug:session:error', {
                    sessionId: payload.sessionId,
                    error: 'Debug session not found'
                });
                return;
            }

            try {
                const response = await this.daemonClient.command<DaemonDebugStepResponse>(
                    entry.teamClusterId,
                    'debug.step',
                    { sessionId: payload.sessionId }
                );

                if (response.result) {
                    this.emitNodeResult(conn.id, payload.sessionId, response.result);
                }

                if (response.hasMore && response.nextNode) {
                    this.emitToSocket(conn.id, 'debug:node:started', {
                        sessionId: payload.sessionId,
                        nodeId: response.nextNode.nodeId,
                        nodeType: response.nextNode.nodeType,
                        index: response.nextNode.index,
                        total: response.nextNode.total
                    });
                } else if (!response.hasMore) {
                    this.emitSessionCompleted(conn.id, payload.sessionId);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Step execution failed';
                logger.error({ err: error }, '@plugin-debug-socket: debug:step failed');
                this.pluginDebugSessionRegistry.unregisterSession(payload.sessionId);
                this.emitToSocket(conn.id, 'debug:session:error', {
                    sessionId: payload.sessionId,
                    error: message
                });
            }
        });
    }

    // --- debug:continue ---

    private registerDebugContinue(connection: ISocketConnection): void {
        this.on<DebugSessionPayload>(connection.id, 'debug:continue', async (conn, payload) => {
            const entry = this.pluginDebugSessionRegistry.getSession(payload.sessionId);
            if (!entry || entry.socketId !== conn.id) {
                this.emitToSocket(conn.id, 'debug:session:error', {
                    sessionId: payload.sessionId,
                    error: 'Debug session not found'
                });
                return;
            }

            try {
                const response = await this.daemonClient.command<DaemonDebugContinueResponse>(
                    entry.teamClusterId,
                    'debug.continue',
                    { sessionId: payload.sessionId }
                );

                // Emit results for each node sequentially
                for (const result of response.results) {
                    this.emitNodeResult(conn.id, payload.sessionId, result);
                }

                // Check if the last result was an error — if so, don't emit session:completed
                const lastResult = response.results[response.results.length - 1];
                if (!lastResult || lastResult.status !== 'error') {
                    this.emitSessionCompleted(conn.id, payload.sessionId);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Continue execution failed';
                logger.error({ err: error }, '@plugin-debug-socket: debug:continue failed');
                this.pluginDebugSessionRegistry.unregisterSession(payload.sessionId);
                this.emitToSocket(conn.id, 'debug:session:error', {
                    sessionId: payload.sessionId,
                    error: message
                });
            }
        });
    }

    // --- debug:stop ---

    private registerDebugStop(connection: ISocketConnection): void {
        this.on<DebugSessionPayload>(connection.id, 'debug:stop', async (conn, payload) => {
            const entry = this.pluginDebugSessionRegistry.getSession(payload.sessionId);
            if (!entry || entry.socketId !== conn.id) {
                return;
            }

            try {
                await this.daemonClient.command(
                    entry.teamClusterId,
                    'debug.stop',
                    { sessionId: payload.sessionId }
                );
            } catch {
                // Ignore errors when stopping
            }

            this.pluginDebugSessionRegistry.unregisterSession(payload.sessionId);
            logger.info(`@plugin-debug-socket: session ${payload.sessionId} stopped by user`);
        });
    }

    // --- Helpers ---

    private emitNodeResult(
        socketId: string,
        sessionId: string,
        result: DaemonDebugNodeResult
    ): void {
        if (result.status === 'completed') {
            this.emitToSocket(socketId, 'debug:node:completed', {
                sessionId,
                nodeId: result.nodeId,
                nodeType: result.nodeType,
                output: result.output ?? {},
                nestedTrace: result.nestedTrace ?? [],
                durationMs: result.durationMs,
                index: 0,
                contextSnapshot: result.contextSnapshot
            });
        } else if (result.status === 'skipped') {
            this.emitToSocket(socketId, 'debug:node:skipped', {
                sessionId,
                nodeId: result.nodeId,
                nodeType: result.nodeType,
                reason: result.reason ?? 'Skipped',
                nestedTrace: result.nestedTrace ?? []
            });
        } else if (result.status === 'error') {
            this.pluginDebugSessionRegistry.unregisterSession(sessionId);
            this.emitToSocket(socketId, 'debug:node:error', {
                sessionId,
                nodeId: result.nodeId,
                nodeType: result.nodeType,
                error: result.error ?? 'Unknown error',
                stack: result.stack,
                nestedTrace: result.nestedTrace ?? []
            });
        }
    }

    private emitSessionCompleted(socketId: string, sessionId: string): void {
        this.emitToSocket(socketId, 'debug:session:completed', {
            sessionId,
            exposureResults: [],
            totalDuration: 0
        });
        this.pluginDebugSessionRegistry.unregisterSession(sessionId);
    }

    private cleanupSessionsForSocket(socketId: string): void {
        for (const [sessionId, entry] of this.pluginDebugSessionRegistry.unregisterSessionsForSocket(socketId)) {
            this.daemonClient.command(entry.teamClusterId, 'debug.stop', { sessionId }).catch(() => {});
        }
    }
}
