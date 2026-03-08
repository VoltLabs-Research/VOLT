import { validateDebugStartPayload } from './DebugSocketPayloadValidator';
import { sanitizeDebugOutput } from './sanitize-debug-output';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import DebugSession from '@modules/plugin/infrastructure/services/plugin/DebugSession';

import { ErrorCodes } from '@core/constants/error-codes';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { createSocketErrorEnvelopeFromApplicationError } from '@modules/socket/infrastructure/utilities/socket-error-envelope';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { Types } from 'mongoose';
import { inject, singleton } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';

import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';

import type { DebugNodeErrorPayload, DebugSocketErrorPayload, DebugStartPayload } from './DebugSocketPayloads';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import type { IPluginWorkflowEngine, DebugHooks } from '@modules/plugin/domain/port/plugin/IPluginWorkflowEngine';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';

@singleton()
export class DebugSocketOrchestrator {
    private readonly sessions = new Map<string, DebugSession>();

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private readonly emitter: ISocketEmitter,
        @inject(PLUGIN_TOKENS.PluginWorkflowEngine)
        private readonly workflowEngine: IPluginWorkflowEngine,
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ) {}

    async start(connection: ISocketConnection, payload: DebugStartPayload): Promise<void> {
        const socketId = connection.id;
        this.disconnect(socketId);

        try {
            const payloadError = validateDebugStartPayload(payload);
            if (payloadError) {
                logger.warn(`[DebugOrchestrator] payload validation failed: ${payloadError.message}`);
                this.emitSessionError(socketId, payloadError);
                return;
            }

            const plugin = await this.pluginRepository.findById(payload.pluginId);
            if (!plugin) {
                this.emitSessionError(socketId, ApplicationError.notFound(
                    ErrorCodes.PLUGIN_NOT_FOUND,
                    ErrorCodes.PLUGIN_NOT_FOUND
                ));
                return;
            }

            const session = new DebugSession({
                pluginId: payload.pluginId,
                trajectoryId: payload.trajectoryId,
                timestep: payload.timestep,
                config: payload.config || {},
                socketId,
                userId: connection.userId || 'anonymous'
            });

            this.sessions.set(socketId, session);

            const teamId = plugin.props.team || connection.user?.teams?.[0] || '';
            const debugAnalysisId = new Types.ObjectId().toString();
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

            let iterationItem: Record<string, unknown> | undefined;
            let iterationIndex = 0;

            if (planResult && planResult.items.length > 0) {
                const matchIndex = planResult.items.findIndex(
                    (item: Record<string, unknown>) => item.timestep === payload.timestep || item.frame === payload.timestep
                );

                iterationIndex = matchIndex >= 0 ? matchIndex : 0;
                iterationItem = planResult.items[iterationIndex] as Record<string, unknown> | undefined;
            }

            const sessionCreatedPayload = {
                sessionId: session.id,
                executionOrder: plugin.props.workflow.topologicalSort().map((node) => ({
                    nodeId: node.id,
                    type: node.type
                })),
                forEachNodeId: planResult?.forEachNodeId ?? null,
                totalIterations: planResult?.items?.length ?? 0
            };
            this.emitter.emitToSocket(socketId, 'debug:session:created', sessionCreatedPayload);

            this.runDebugExecution(socketId, session, plugin, payload, iterationItem, iterationIndex, teamId, debugAnalysisId)
                .catch((error) => {
                    const normalizedError = error instanceof Error ? error : new Error(String(error));
                    const terminationError = session.getTerminationError();
                    const errorToEmit = terminationError || this.normalizeDebugError(normalizedError);

                    if (terminationError || !session.aborted) {
                        logger.error(`[DebugSocketModule] Execution error: ${normalizedError.message}`);
                        this.emitSessionError(socketId, errorToEmit, session.id);
                    }

                    session.destroy();
                    this.sessions.delete(socketId);
                });
        } catch (error: unknown) {
            const normalizedError = this.normalizeDebugError(error);
            logger.error(`[DebugSocketModule] Failed to start debug: ${normalizedError.message}`);
            this.emitSessionError(socketId, normalizedError);
        }
    }

    step(socketId: string, sessionId: string): void {
        const session = this.sessions.get(socketId);
        if (!session || session.id !== sessionId) {
            return;
        }

        session.step();
    }

    continue(socketId: string, sessionId: string): void {
        const session = this.sessions.get(socketId);
        if (!session || session.id !== sessionId) {
            return;
        }

        session.continue();
    }

    stop(socketId: string, sessionId: string): void {
        const session = this.sessions.get(socketId);
        if (!session || session.id !== sessionId) {
            return;
        }

        session.stop();
        this.sessions.delete(socketId);
    }

    disconnect(socketId: string): void {
        const session = this.sessions.get(socketId);
        if (!session) {
            return;
        }

        session.destroy();
        this.sessions.delete(socketId);
        logger.debug(`[DebugSocketModule] Destroyed session for socket ${socketId}`);
    }

    async shutdown(): Promise<void> {
        for (const session of this.sessions.values()) {
            session.destroy();
        }

        this.sessions.clear();
    }

    private async runDebugExecution(
        socketId: string,
        session: DebugSession,
        plugin: Plugin,
        payload: DebugStartPayload,
        iterationItem: Record<string, unknown> | undefined,
        iterationIndex: number,
        teamId: string,
        debugAnalysisId: string
    ): Promise<void> {
        const startTime = Date.now();

        const hooks: DebugHooks = {
            onNodeStart: async (nodeId, nodeType, index, total) => {
                this.emitter.emitToSocket(socketId, 'debug:node:started', {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    index,
                    total
                });

                await session.waitForStep();
            },
            onNodeCompleted: async (nodeId, nodeType, output, durationMs, index, contextSnapshot) => {
                const sanitizedOutput = isRecord(output)
                    ? sanitizeDebugOutput(output)
                    : { value: output };
                const sanitizedContext: Record<string, Record<string, unknown>> = {};

                for (const [key, value] of Object.entries(contextSnapshot)) {
                    sanitizedContext[key] = isRecord(value)
                        ? sanitizeDebugOutput(value)
                        : { value };
                }

                this.emitter.emitToSocket(socketId, 'debug:node:completed', {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    output: sanitizedOutput,
                    durationMs,
                    index,
                    contextSnapshot: sanitizedContext
                });
            },
            onNodeSkipped: async (nodeId, nodeType, reason) => {
                this.emitter.emitToSocket(socketId, 'debug:node:skipped', {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    reason
                });
            },
            onNodeError: async (nodeId, nodeType, error) => {
                const envelope = createSocketErrorEnvelopeFromApplicationError(this.normalizeDebugError(error));
                const payload: DebugNodeErrorPayload = {
                    sessionId: session.id,
                    nodeId,
                    nodeType,
                    error: envelope.details || envelope.message,
                    code: envelope.code,
                    details: envelope.details,
                    stack: error.stack?.split('\n').slice(0, 5).join('\n')
                };

                this.emitter.emitToSocket(socketId, 'debug:node:error', payload);
            }
        };

        const results = await this.workflowEngine.executeWorkflowJob(
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
        this.emitter.emitToSocket(socketId, 'debug:session:completed', {
            sessionId: session.id,
            exposureResults: results.map((result) => ({
                exposureName: result.exposureName,
                nodeId: result.nodeId
            })),
            totalDuration
        });

        session.destroy();
        this.sessions.delete(socketId);
    }

    private normalizeDebugError(error: unknown): ApplicationError {
        if (error instanceof ApplicationError) {
            return error;
        }

        if (error instanceof Error) {
            if (error.message === ErrorCodes.PLUGIN_NOT_FOUND) {
                return ApplicationError.notFound(error.message, error.message);
            }

            return ApplicationError.internalServerError(error.message);
        }

        return ApplicationError.internalServerError(String(error));
    }

    private emitSessionError(socketId: string, error: ApplicationError, sessionId?: string): void {
        const envelope = createSocketErrorEnvelopeFromApplicationError(error);
        const payload: DebugSocketErrorPayload = {
            sessionId,
            error: envelope.details || envelope.message,
            code: envelope.code,
            message: envelope.message,
            details: envelope.details
        };

        this.emitter.emitToSocket(socketId, 'debug:session:error', payload);
    }
};
