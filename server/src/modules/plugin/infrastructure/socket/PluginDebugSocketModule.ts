import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow, { type WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import type { PluginReferenceExecutionRequest } from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import {
    WorkflowValidationMode
} from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { PluginDependencyResolverService } from '@modules/plugin/infrastructure/services/plugin/PluginDependencyResolverService';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/plugin/WorkflowValidatorService';
import PluginDebugSessionRegistryService from '@modules/plugin/infrastructure/services/PluginDebugSessionRegistryService';
import { sanitizeVisibleArgumentConfig } from '@modules/plugin/utilities/plugin/argument-visibility';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { ChannelCommands, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@shared/infrastructure/contracts/team-cluster';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

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

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class PluginDebugSocketModule extends BaseSocketModule {
    public readonly name = 'PluginDebugSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        
        private readonly daemonClient: TeamClusterDaemonClient,
        
        private readonly teamSubscriptionCoordinator: SocketTeamSubscriptionCoordinator,
        
        private readonly pluginRepository: PluginRepository,
        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly trajectoryFrameRepository: TrajectoryFrameRepository,
        
        private readonly teamClusterSelectionService: TeamClusterSelectionService,
        
        private readonly pluginDebugSessionRegistry: PluginDebugSessionRegistryService,
        
        private readonly pluginDependencyResolverService: PluginDependencyResolverService,
        
        private readonly workflowValidator: WorkflowValidatorService
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
                await this.daemonClient.command(entry.teamClusterId, ChannelCommands.DebugStop, { sessionId });
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
                const runtimeArgumentsNode = runtimePlugin.props.workflow.props.nodes.find((node) => node.type === 'arguments');
                const runtimeArguments = Array.isArray(runtimeArgumentsNode?.data.arguments?.arguments)
                    ? runtimeArgumentsNode.data.arguments.arguments
                    : [];
                const sanitizedConfig = sanitizeVisibleArgumentConfig(runtimeArguments, payload.config ?? {});

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
                    sanitizedConfig
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

                const trajectoryFrames = await this.trajectoryFrameRepository.getFrames(payload.trajectoryId);

                // Send debug.start command to daemon
                const response = await this.daemonClient.command<DaemonDebugStartResponse>(
                    teamClusterId,
                    ChannelCommands.DebugStart,
                    {
                        workflow,
                        trajectoryId: payload.trajectoryId,
                        trajectoryFrames,
                        pluginId: payload.pluginId,
                        teamId,
                        storageClusterId,
                        nestedPlugins,
                        pluginReferenceExecutions: pluginReferenceExecutions as PluginReferenceExecutionRequest[],
                        config: sanitizedConfig,
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
                logger.error(`@plugin-debug-socket: debug:start failed`);
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
                    ChannelCommands.DebugStep,
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
                logger.error(`@plugin-debug-socket: debug:step failed`);
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
                    ChannelCommands.DebugContinue,
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
                logger.error(`@plugin-debug-socket: debug:continue failed`);
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
                    ChannelCommands.DebugStop,
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
            this.daemonClient.command(entry.teamClusterId, ChannelCommands.DebugStop, { sessionId }).catch(() => {});
        }
    }
}
