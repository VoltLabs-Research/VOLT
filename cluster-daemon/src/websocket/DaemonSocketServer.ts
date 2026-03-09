import {
    AnalysisStartRequest,
    CreateNotebookSessionRequest,
    TrajectoryPreprocessRequest
} from '../contracts/http';
import { RuntimeLifecycleEvent, RuntimeProgressEvent } from '../contracts/events';
import {
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_DAEMON_REQUEST_EVENT,
    TEAM_CLUSTER_DAEMON_RESPONSE_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_END_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_ERROR_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ATTACHED_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_DATA_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT,
    type TeamClusterDaemonRegisterPayload,
    type TeamClusterDaemonSocketRequestPayload,
    type TeamClusterDaemonTerminalAttachPayload,
    type TeamClusterDaemonTerminalDetachPayload,
    type TeamClusterDaemonTerminalInputPayload,
    type TeamClusterDaemonTerminalResizePayload,
    type TeamClusterDaemonWebSocketAttachPayload,
    type TeamClusterDaemonWebSocketDataPayload,
    type TeamClusterDaemonWebSocketDetachPayload
} from '../contracts/reverseChannel';
import { DaemonConfig } from '../config/env';
import { DockerRuntimeService } from '../services/DockerRuntimeService';
import { MetricsService } from '../services/MetricsService';
import { OrchestrationService } from '../services/OrchestrationService';
import { RuntimeEventBroker } from '../services/RuntimeEventBroker';
import { ReverseChannelSocketBridge } from './ReverseChannelSocketBridge';
import { secureCompare } from '../utilities/compare';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';

interface DaemonSocketDependencies {
    config: DaemonConfig;
    server: HttpServer;
    dockerRuntimeService: DockerRuntimeService;
    orchestrationService: OrchestrationService;
    metricsService: MetricsService;
    eventBroker: RuntimeEventBroker;
};

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

export class DaemonSocketServer {
    private readonly io: SocketIOServer;
    private readonly metricsIntervals: Map<string, NodeJS.Timeout> = new Map();
    private readonly lifecycleSubscriptions: Map<string, () => void> = new Map();
    private readonly progressSubscriptions: Map<string, () => void> = new Map();
    private readonly reverseChannelSocketBridge: ReverseChannelSocketBridge;

    constructor(private readonly dependencies: DaemonSocketDependencies) {
        this.io = new SocketIOServer(dependencies.server, {
            transports: ['websocket', 'polling'],
            cors: {
                origin: true,
                methods: ['GET', 'POST']
            }
        });
        this.reverseChannelSocketBridge = new ReverseChannelSocketBridge(
            dependencies.config,
            dependencies.dockerRuntimeService
        );
    }

    initialize(): void {
        this.io.use((socket, next) => {
            const auth = this.readSocketAuthPayload(socket.handshake.auth);
            if (!auth?.token || !secureCompare(auth.token, this.dependencies.config.daemonPassword)) {
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
            this.io.close(() => resolve());
        });
    }

    private registerConnection(socket: Socket): void {
        socket.on('metrics:subscribe', () => {
            const existingInterval = this.metricsIntervals.get(socket.id);
            if (existingInterval) {
                clearInterval(existingInterval);
            }

            const pushMetrics = async () => {
                socket.emit('metrics:update', await this.dependencies.metricsService.collectSnapshot());
            };

            const interval = setInterval(() => {
                pushMetrics().catch((error: unknown) => {
                    emitError(socket, error instanceof Error ? error.message : 'Failed to publish metrics');
                });
            }, this.dependencies.config.metricsIntervalMs);

            this.metricsIntervals.set(socket.id, interval);
            pushMetrics().catch((error: unknown) => {
                emitError(socket, error instanceof Error ? error.message : 'Failed to publish metrics');
            });
        });

        socket.on('lifecycle:subscribe', () => {
            const unsubscribe = this.dependencies.eventBroker.onLifecycle((event: RuntimeLifecycleEvent) => {
                socket.emit('lifecycle:event', event);
            });
            this.lifecycleSubscriptions.set(socket.id, unsubscribe);

            const latestEvent = this.dependencies.eventBroker.getLatestLifecycleEvent();
            if (latestEvent) {
                socket.emit('lifecycle:event', latestEvent);
            }
        });

        socket.on('progress:subscribe', () => {
            const unsubscribe = this.dependencies.eventBroker.onProgress((event: RuntimeProgressEvent) => {
                socket.emit('progress:event', event);
            });
            this.progressSubscriptions.set(socket.id, unsubscribe);
        });

        socket.on('analysis:start', async (payload: AnalysisStartRequest) => {
            try {
                await this.dependencies.orchestrationService.startAnalysis(payload);
                socket.emit('analysis:accepted', {
                    analysisId: payload.analysisId
                });
            } catch (error: unknown) {
                emitError(socket, error instanceof Error ? error.message : 'Failed to queue analysis');
            }
        });

        socket.on('trajectory:preprocess', async (payload: TrajectoryPreprocessRequest) => {
            try {
                await this.dependencies.orchestrationService.preprocessTrajectory(payload);
                socket.emit('trajectory:accepted', {
                    trajectoryId: payload.trajectoryId
                });
            } catch (error: unknown) {
                emitError(socket, error instanceof Error ? error.message : 'Failed to queue trajectory preprocessing');
            }
        });

        socket.on('notebook:session:start', async (payload: CreateNotebookSessionRequest) => {
            socket.emit('notebook:session:event', {
                requestedBy: payload.requestedBy,
                status: 'pending-runtime-wiring'
            });
        });

        socket.on(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, (payload: TeamClusterDaemonRegisterPayload) => {
            if (payload.teamClusterId !== this.dependencies.config.teamClusterId) {
                socket.disconnect();
                return;
            }

            if (!secureCompare(payload.daemonPassword, this.dependencies.config.daemonPassword)) {
                socket.disconnect();
                return;
            }

            socket.emit(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, {
                teamClusterId: this.dependencies.config.teamClusterId
            });
        });

        socket.on(TEAM_CLUSTER_DAEMON_REQUEST_EVENT, async (payload: TeamClusterDaemonSocketRequestPayload) => {
            await this.reverseChannelSocketBridge.handleRequest(socket, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT, async (payload: TeamClusterDaemonTerminalAttachPayload) => {
            await this.reverseChannelSocketBridge.handleTerminalAttach(socket, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT, (payload: TeamClusterDaemonTerminalInputPayload) => {
            this.reverseChannelSocketBridge.handleTerminalInput(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT, (payload: TeamClusterDaemonTerminalResizePayload) => {
            this.reverseChannelSocketBridge.handleTerminalResize(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT, (payload: TeamClusterDaemonTerminalDetachPayload) => {
            this.reverseChannelSocketBridge.handleTerminalDetach(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT, (payload: TeamClusterDaemonWebSocketAttachPayload) => {
            this.reverseChannelSocketBridge.handleWebSocketAttach(socket, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT, (payload: TeamClusterDaemonWebSocketDataPayload) => {
            this.reverseChannelSocketBridge.handleWebSocketInput(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT, (payload: TeamClusterDaemonWebSocketDetachPayload) => {
            this.reverseChannelSocketBridge.handleWebSocketDetach(payload);
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
}
