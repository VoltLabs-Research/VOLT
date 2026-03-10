import { createNotebookSessionSchema } from '../http/validation/schemas';
import { parseValue } from '../http/common';
import { preprocessTrajectory, startAnalysis } from '../core/runtimeActions';
import { secureCompare } from '../utilities/compare';
import {
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    type TeamClusterDaemonRegisterPayload
} from '../contracts/reverseChannel';
import { DAEMON_TOKENS } from '../core/tokens';
import { DockerRuntimeService } from '../infrastructure/docker/DockerRuntimeService';
import { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import { QueueService } from '../infrastructure/redis/QueueService';
import { RedisConnectionService } from '../infrastructure/redis/RedisConnectionService';
import { MetricsService } from '../modules/metrics/MetricsService';
import { ReverseChannelSocketBridge } from './ReverseChannelSocketBridge';
import { inject, injectable } from 'tsyringe';
import { Server as SocketIOServer } from 'socket.io';
import type { RuntimeLifecycleEvent, RuntimeProgressEvent } from '../contracts/events';
import type { AnalysisStartRequest, CreateNotebookSessionRequest, TrajectoryPreprocessRequest } from '../contracts/http';
import type { DaemonConfig } from '../core/config';
import type { Server as HttpServer } from 'node:http';
import type { Socket } from 'socket.io';

interface SocketAuthPayload {
    token?: string;
};

interface SocketMessageEnvelope {
    message: string;
};

const emitError = (socket: Socket, message: string): void => {
    const payload: SocketMessageEnvelope = { message };
    socket.emit('error', payload);
};

@injectable()
export class DaemonSocketServer {
    private readonly metricsIntervals = new Map<string, NodeJS.Timeout>();
    private readonly lifecycleSubscriptions = new Map<string, () => void>();
    private readonly progressSubscriptions = new Map<string, () => void>();
    private readonly reverseChannelSocketBridge: ReverseChannelSocketBridge;
    private io: SocketIOServer | null = null;

    constructor(
        @inject(DAEMON_TOKENS.Config)
        private readonly config: DaemonConfig,
        @inject(DAEMON_TOKENS.DockerRuntimeService)
        dockerRuntimeService: DockerRuntimeService,
        @inject(DAEMON_TOKENS.QueueService)
        private readonly queueService: QueueService,
        @inject(DAEMON_TOKENS.RedisConnection)
        private readonly redisConnectionService: RedisConnectionService,
        @inject(DAEMON_TOKENS.MetricsService)
        private readonly metricsService: MetricsService,
        @inject(DAEMON_TOKENS.RuntimeEventBroker)
        private readonly eventBroker: RuntimeEventBroker
    ) {
        this.reverseChannelSocketBridge = new ReverseChannelSocketBridge(config, dockerRuntimeService);
    }

    initialize(server: HttpServer): void {
        this.io = new SocketIOServer(server, {
            transports: ['websocket', 'polling'],
            cors: {
                origin: true,
                methods: ['GET', 'POST']
            }
        });

        this.io.use((socket, next) => {
            const auth = this.readSocketAuthPayload(socket.handshake.auth);
            if (!auth?.token || !secureCompare(auth.token, this.config.daemonPassword)) {
                next(new Error('Unauthorized'));
                return;
            }

            next();
        });

        this.io.on('connection', (socket) => {
            this.registerConnection(socket);
        });
    }

    close(): Promise<void> {
        return new Promise((resolve) => {
            this.io?.close(() => resolve());
        });
    }

    private registerConnection(socket: Socket): void {
        socket.on('metrics:subscribe', () => {
            const existingInterval = this.metricsIntervals.get(socket.id);
            if (existingInterval) {
                clearInterval(existingInterval);
            }

            const pushMetrics = async () => {
                socket.emit('metrics:update', await this.metricsService.collectSnapshot());
            };

            const interval = setInterval(() => {
                pushMetrics().catch((error: unknown) => {
                    emitError(socket, error instanceof Error ? error.message : 'Failed to publish metrics');
                });
            }, this.config.metricsIntervalMs);

            this.metricsIntervals.set(socket.id, interval);
            pushMetrics().catch((error: unknown) => {
                emitError(socket, error instanceof Error ? error.message : 'Failed to publish metrics');
            });
        });

        socket.on('lifecycle:subscribe', () => {
            const unsubscribe = this.eventBroker.onLifecycle((event: RuntimeLifecycleEvent) => {
                socket.emit('lifecycle:event', event);
            });
            this.lifecycleSubscriptions.set(socket.id, unsubscribe);

            const latestEvent = this.eventBroker.getLatestLifecycleEvent();
            if (latestEvent) {
                socket.emit('lifecycle:event', latestEvent);
            }
        });

        socket.on('progress:subscribe', () => {
            const unsubscribe = this.eventBroker.onProgress((event: RuntimeProgressEvent) => {
                socket.emit('progress:event', event);
            });
            this.progressSubscriptions.set(socket.id, unsubscribe);
        });

        socket.on('analysis:start', async (payload: AnalysisStartRequest) => {
            try {
                await startAnalysis(payload, this.queueService, this.redisConnectionService, this.eventBroker);
                socket.emit('analysis:accepted', {
                    analysisId: payload.analysisId
                });
            } catch (error: unknown) {
                emitError(socket, error instanceof Error ? error.message : 'Failed to queue analysis');
            }
        });

        socket.on('trajectory:preprocess', async (payload: TrajectoryPreprocessRequest) => {
            try {
                await preprocessTrajectory(payload, this.queueService, this.eventBroker);
                socket.emit('trajectory:accepted', {
                    trajectoryId: payload.trajectoryId
                });
            } catch (error: unknown) {
                emitError(socket, error instanceof Error ? error.message : 'Failed to queue trajectory preprocessing');
            }
        });

        socket.on('notebook:session:start', async (payload: CreateNotebookSessionRequest) => {
            const requestBody = parseValue(createNotebookSessionSchema, payload);
            socket.emit('notebook:session:event', {
                requestedBy: requestBody.requestedBy,
                status: 'pending-runtime-wiring'
            });
        });

        socket.on(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, (payload: TeamClusterDaemonRegisterPayload) => {
            if (payload.teamClusterId !== this.config.teamClusterId) {
                socket.disconnect();
                return;
            }

            if (!secureCompare(payload.daemonPassword, this.config.daemonPassword)) {
                socket.disconnect();
                return;
            }

            socket.emit(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, {
                teamClusterId: this.config.teamClusterId
            });
        });

        this.reverseChannelSocketBridge.bindToSocket(socket as unknown as {
            emit(event: string, payload: unknown): void;
            on(event: string, listener: (payload: never) => void): void;
        });

        socket.on('disconnect', () => {
            const interval = this.metricsIntervals.get(socket.id);
            if (interval) {
                clearInterval(interval);
                this.metricsIntervals.delete(socket.id);
            }

            const lifecycleUnsubscribe = this.lifecycleSubscriptions.get(socket.id);
            lifecycleUnsubscribe?.();
            this.lifecycleSubscriptions.delete(socket.id);

            const progressUnsubscribe = this.progressSubscriptions.get(socket.id);
            progressUnsubscribe?.();
            this.progressSubscriptions.delete(socket.id);

            this.reverseChannelSocketBridge.cleanup();
        });
    }

    private readSocketAuthPayload(payload: unknown): SocketAuthPayload | null {
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
            return null;
        }

        const token = Reflect.get(payload, 'token');
        if (typeof token !== 'string') {
            return null;
        }

        return {
            token
        };
    }
};
