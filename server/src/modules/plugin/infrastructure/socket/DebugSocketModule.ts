import { inject, singleton } from 'tsyringe';
import { Types } from 'mongoose';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginWorkflowEngine, DebugHooks } from '@modules/plugin/domain/ports/IPluginWorkflowEngine';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import DebugSession from '@modules/plugin/infrastructure/services/DebugSession';
import logger from '@shared/infrastructure/logger';

interface DebugStartPayload {
    pluginId: string;
    trajectoryId: string;
    timestep: number;
    config: Record<string, any>;
};

/**
 * Sanitize output data before sending to the client.
 * Truncates large arrays, removes filesystem paths, limits depth.
 */
function sanitizeOutput(data: Record<string, any>, maxArrayLength = 50, maxDepth = 5): Record<string, any> {
    function sanitize(value: any, depth: number): any {
        if (depth > maxDepth) return '[max depth exceeded]';
        if (value === null || value === undefined) return value;

        if (typeof value === 'string') {
            // Remove absolute filesystem paths
            if (value.startsWith('/tmp/') || value.startsWith('/home/') || value.startsWith('/var/')) {
                return '[server path]';
            }
            // Truncate very long strings
            if (value.length > 2000) {
                return value.substring(0, 2000) + `... [truncated, total ${value.length} chars]`;
            }
            return value;
        }

        if (typeof value === 'number' || typeof value === 'boolean') return value;

        if (ArrayBuffer.isView(value)) {
            const arr = value as any;
            const len = arr.length ?? arr.byteLength;
            return { _type: value.constructor.name, length: len, preview: Array.from(arr.slice(0, 10)) };
        }

        if (Array.isArray(value)) {
            if (value.length > maxArrayLength) {
                return {
                    _truncated: true,
                    totalLength: value.length,
                    preview: value.slice(0, maxArrayLength).map((v) => sanitize(v, depth + 1))
                };
            }
            return value.map((v) => sanitize(v, depth + 1));
        }

        if (typeof value === 'object') {
            if (value instanceof Map) {
                const obj: Record<string, any> = {};
                value.forEach((v, k) => { obj[String(k)] = sanitize(v, depth + 1); });
                return obj;
            }
            const result: Record<string, any> = {};
            for (const [k, v] of Object.entries(value)) {
                result[k] = sanitize(v, depth + 1);
            }
            return result;
        }

        return String(value);
    }

    return sanitize(data, 0) as Record<string, any>;
}

@singleton()
export default class DebugSocketModule extends BaseSocketModule {
    public readonly name = 'DebugSocketModule';

    /** Active debug sessions keyed by socket ID */
    private sessions = new Map<string, DebugSession>();

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any,
        @inject(PLUGIN_TOKENS.PluginWorkflowEngine)
        private readonly workflowEngine: IPluginWorkflowEngine,
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info('[DebugSocketModule] Initialized');
    }

    onConnection(connection: ISocketConnection): void {
        this.on<DebugStartPayload>(connection.id, 'debug:start', async (conn, payload) => {
            await this.handleDebugStart(conn, payload);
        });

        this.on<{ sessionId: string }>(connection.id, 'debug:step', async (conn, payload) => {
            this.handleDebugStep(conn, payload.sessionId);
        });

        this.on<{ sessionId: string }>(connection.id, 'debug:continue', async (conn, payload) => {
            this.handleDebugContinue(conn, payload.sessionId);
        });

        this.on<{ sessionId: string }>(connection.id, 'debug:stop', async (conn, payload) => {
            this.handleDebugStop(conn, payload.sessionId);
        });

        this.onDisconnect(connection.id, async () => {
            this.destroySessionForSocket(connection.id);
        });
    }

    async onShutdown(): Promise<void> {
        for (const [, session] of this.sessions) {
            session.destroy();
        }
        this.sessions.clear();
        logger.info('[DebugSocketModule] Shutdown complete');
    }

    private async handleDebugStart(conn: ISocketConnection, payload: DebugStartPayload): Promise<void> {
        const socketId = conn.id;

        // Destroy existing session for this socket if any
        this.destroySessionForSocket(socketId);

        try {
            // Load plugin (allow any status for debug)
            const plugin = await this.pluginRepository.findById(payload.pluginId);
            if (!plugin) {
                this.emitToSocket(socketId, 'debug:session:error', {
                    error: 'Plugin not found'
                });
                return;
            }

            // Create debug session
            const session = new DebugSession({
                pluginId: payload.pluginId,
                trajectoryId: payload.trajectoryId,
                timestep: payload.timestep,
                config: payload.config || {},
                socketId,
                userId: conn.userId || 'anonymous'
            });

            this.sessions.set(socketId, session);

            const teamId = plugin.props.team || conn.user?.teams?.[0] || '';
            // Generate a valid MongoDB ObjectId so node handlers that query
            // by analysisId (e.g. ModifierHandler.findById) don't crash on cast.
            const debugAnalysisId = new Types.ObjectId().toString();

            // Plan execution to determine iteration items
            const planResult = await this.workflowEngine.planExecutionStrategy({
                plugin,
                trajectoryId: payload.trajectoryId,
                analysisId: debugAnalysisId,
                userConfig: payload.config || {},
                teamId,
                options: {
                    selectedFrameOnly: true,
                    timestep: payload.timestep
                }
            });

            // Pick the iteration item for the selected timestep
            let iterationItem: any = null;
            let iterationIndex = 0;

            if (planResult && planResult.items.length > 0) {
                // Try to find the exact timestep match
                const matchIndex = planResult.items.findIndex(
                    (item: any) => item.timestep === payload.timestep || item.frame === payload.timestep
                );
                iterationIndex = matchIndex >= 0 ? matchIndex : 0;
                iterationItem = planResult.items[iterationIndex];
            }

            // Get execution order for the UI
            const executionOrder = plugin.props.workflow.topologicalSort().map((node) => ({
                nodeId: node.id,
                type: node.type
            }));

            // Emit session created with execution order + ForEach info
            this.emitToSocket(socketId, 'debug:session:created', {
                sessionId: session.id,
                executionOrder,
                forEachNodeId: planResult?.forEachNodeId ?? null,
                totalIterations: planResult?.items?.length ?? 0
            });

            // Execute workflow with debug hooks (async, runs in background)
            this.runDebugExecution(socketId, session, plugin, payload, iterationItem, iterationIndex, teamId, debugAnalysisId)
                .catch((err) => {
                    if (!session.aborted) {
                        logger.error(`[DebugSocketModule] Execution error: ${err.message}`);
                        this.emitToSocket(socketId, 'debug:session:error', {
                            sessionId: session.id,
                            error: err.message
                        });
                    }
                    this.sessions.delete(socketId);
                });

        } catch (error: any) {
            logger.error(`[DebugSocketModule] Failed to start debug: ${error.message}`);
            this.emitToSocket(socketId, 'debug:session:error', {
                error: error.message
            });
        }
    }

    private async runDebugExecution(
        socketId: string,
        session: DebugSession,
        plugin: any,
        payload: DebugStartPayload,
        iterationItem: any,
        iterationIndex: number,
        teamId: string,
        debugAnalysisId: string
    ): Promise<void> {
        const startTime = Date.now();

        const hooks: DebugHooks = {
            onNodeStart: async (nodeId, nodeType, index, total) => {
                this.emitToSocket(socketId, 'debug:node:started', {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    index,
                    total
                });

                // Wait for client to step/continue (gate pattern)
                await session.waitForStep();
            },

            onNodeCompleted: async (nodeId, nodeType, output, durationMs, index, contextSnapshot) => {
                const sanitized = sanitizeOutput(output);
                const sanitizedContext: Record<string, any> = {};
                for (const [key, value] of Object.entries(contextSnapshot)) {
                    sanitizedContext[key] = sanitizeOutput(value);
                }
                this.emitToSocket(socketId, 'debug:node:completed', {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    output: sanitized,
                    durationMs,
                    index,
                    contextSnapshot: sanitizedContext
                });
            },

            onNodeSkipped: async (nodeId, nodeType, reason) => {
                this.emitToSocket(socketId, 'debug:node:skipped', {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    reason
                });
            },

            onNodeError: async (nodeId, nodeType, error) => {
                this.emitToSocket(socketId, 'debug:node:error', {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    error: error.message,
                    stack: error.stack?.split('\n').slice(0, 5).join('\n')
                });
            }
        };

        const results = await this.workflowEngine.executeWorkflowJobWithDebugHooks(
            {
                plugin,
                trajectoryId: payload.trajectoryId,
                analysisId: debugAnalysisId,
                userConfig: payload.config || {},
                teamId,
                options: {
                    selectedFrameOnly: true,
                    timestep: payload.timestep
                },
                currentIterationItem: iterationItem,
                currentIterationIndex: iterationIndex
            },
            hooks
        );

        const totalDuration = Date.now() - startTime;

        this.emitToSocket(socketId, 'debug:session:completed', {
            sessionId: session.id,
            exposureResults: results.map((r) => ({
                exposureName: r.exposureName,
                nodeId: r.nodeId
            })),
            totalDuration
        });

        session.destroy();
        this.sessions.delete(socketId);
    }

    private handleDebugStep(conn: ISocketConnection, sessionId: string): void {
        const session = this.sessions.get(conn.id);
        if (!session || session.id !== sessionId) return;
        session.step();
    }

    private handleDebugContinue(conn: ISocketConnection, sessionId: string): void {
        const session = this.sessions.get(conn.id);
        if (!session || session.id !== sessionId) return;
        session.continue();
    }

    private handleDebugStop(conn: ISocketConnection, sessionId: string): void {
        const session = this.sessions.get(conn.id);
        if (!session || session.id !== sessionId) return;
        session.stop();
        this.sessions.delete(conn.id);
    }

    private destroySessionForSocket(socketId: string): void {
        const session = this.sessions.get(socketId);
        if (session) {
            session.destroy();
            this.sessions.delete(socketId);
            logger.debug(`[DebugSocketModule] Destroyed session for socket ${socketId}`);
        }
    }
};
