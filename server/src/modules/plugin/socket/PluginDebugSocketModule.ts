import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import PluginEntity from '@modules/plugin/models/Plugin';
import { toPluginLike } from '@modules/plugin/services/plugin/PluginQueries';
import type { Plugin } from '@modules/plugin/contracts/domain/plugin';
import { PluginStatus } from '@volt/contracts/modules/plugin/domain/enums';
import Workflow, { type WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import type { PluginReferenceExecutionRequest } from '@modules/plugin/services/plugin/PluginExecutionRouter';
import {
    WorkflowValidationMode
} from '@modules/plugin/services/plugin/WorkflowValidatorService';
import { PluginDependencyResolverService } from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import { WorkflowValidatorService } from '@modules/plugin/services/plugin/WorkflowValidatorService';
import pluginDebugSessionRegistrySingleton from '@modules/plugin/services/PluginDebugSessionRegistryService';
import { sanitizeVisibleArgumentConfig } from '@modules/plugin/services/plugin/ArgumentVisibility';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { socketTeamSubscriptionCoordinator } from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';

import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import { getTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryReader';

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

const createRuntimePlugin = (plugin: Plugin, workflow: WorkflowProps): Plugin => ({
    _id: plugin.id,
    id: plugin.id,
    props: {
        ...plugin.props,
        workflow: new Workflow(plugin.id, workflow),
        status: plugin.props.status ?? PluginStatus.DRAFT
    }
});

export class PluginDebugSocketModule extends BaseSocketModule {
    public readonly name = 'PluginDebugSocketModule';

    private readonly pluginDependencyResolverService: PluginDependencyResolverService;
    private readonly workflowValidator: WorkflowValidatorService;

    private readonly teamSubscriptionCoordinator = socketTeamSubscriptionCoordinator;
    private readonly pluginDebugSessionRegistry = pluginDebugSessionRegistrySingleton;

        private readonly daemonClient = teamClusterDaemonClient;

    private readonly teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
        this.pluginDependencyResolverService = new PluginDependencyResolverService();
        this.workflowValidator = new WorkflowValidatorService(this.pluginDependencyResolverService);
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
        for (const [sessionId, entry] of this.pluginDebugSessionRegistry.listSessions()) {
            try {
                await this.daemonClient.command(entry.teamClusterId, ChannelCommands.DebugStop, { sessionId });
            } catch {
            }
        }
    }

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

                const pluginEntity = await PluginEntity.findOneBy({ id: payload.pluginId });
                const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
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

                const trajectory = await TrajectoryEntity.findOneBy({ id: payload.trajectoryId });
                if (!trajectory) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: 'Trajectory not found'
                    });
                    return;
                }
                const storageClusterId = trajectory.storageClusterId;
                if (!storageClusterId) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: 'Trajectory does not have a storage cluster assigned'
                    });
                    return;
                }
                const pluginReferenceValidation = await this.pluginDependencyResolverService.validateArgumentPluginReferenceExecutions(
                    runtimePlugin,
                    sanitizedConfig
                );
                if (pluginReferenceValidation.errors.length > 0) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: pluginReferenceValidation.errors.join('; ')
                    });
                    return;
                }
                const pluginReferenceExecutions = pluginReferenceValidation.executions;
                const dependencyResolution = await this.pluginDependencyResolverService.collectTransitivePublishedDependencies(runtimePlugin);
                if (dependencyResolution.errors.length > 0) {
                    this.emitToSocket(conn.id, 'debug:session:error', {
                        error: dependencyResolution.errors.join('; ')
                    });
                    return;
                }

                const runtimePlugins = pluginReferenceValidation.plugins;
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

                const trajectoryFrames = await getTrajectoryFrames(payload.trajectoryId);

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

                this.pluginDebugSessionRegistry.registerSession(response.sessionId, {
                    socketId: conn.id,
                    teamClusterId
                });

                this.emitToSocket(conn.id, 'debug:session:created', {
                    sessionId: response.sessionId,
                    executionOrder: response.executionOrder,
                    forEachNodeId: response.forEachNodeId,
                    totalIterations: response.totalIterations
                });

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

                for (const result of response.results) {
                    this.emitNodeResult(conn.id, payload.sessionId, result);
                }

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
            }

            this.pluginDebugSessionRegistry.unregisterSession(payload.sessionId);
            logger.info(`@plugin-debug-socket: session ${payload.sessionId} stopped by user`);
        });
    }

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

export default new PluginDebugSocketModule();
