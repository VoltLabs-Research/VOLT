import { io, type Socket } from 'socket.io-client';
import http from 'node:http';
import https from 'node:https';

import { loadConfig } from '@/core/config';
import { logger } from '@/core/logger';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import type { TeamClusterDaemonRuntimeConfig } from '@/core/runtime/contracts/team-cluster-runtime';

interface RuntimeConfigMessage {
    type: 'runtime-config';
    runtimeConfig: TeamClusterDaemonRuntimeConfig | null;
}

const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = 'team-cluster-daemon:register';
const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = 'team-cluster-daemon:registered';
const TEAM_CLUSTER_DAEMON_MESSAGE_EVENT = 'team-cluster-daemon:message';
const HEARTBEAT_CHANNEL = 'heartbeat';
const VOLT_HEALTHCHECK_PATH = '/healthz';

const config = loadConfig();
const metricsService = new MetricsService();

let socket: Socket | null = null;
let registered = false;
let runtimeConfig: TeamClusterDaemonRuntimeConfig | null = null;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let latencyProbeTimer: ReturnType<typeof setInterval> | null = null;
let lastCloudLatencyMs: number | null = null;

const clearHeartbeatTimer = (): void => {
    if (!heartbeatTimer) return;
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
};

const scheduleHeartbeat = (immediate = false): void => {
    clearHeartbeatTimer();
    const delay = immediate ? 0 : config.heartbeatIntervalMs;
    heartbeatTimer = setTimeout(() => {
        sendHeartbeat()
            .catch((error) => {
                logger.warn(`Heartbeat plane failed: ${error instanceof Error ? error.message : String(error)}`);
            })
            .finally(() => {
                if (registered) {
                    scheduleHeartbeat(false);
                }
            });
    }, delay);
    heartbeatTimer.unref();
};

const emitHeartbeatEvent = (payload: object): void => {
    const activeSocket = socket;
    if (!activeSocket || !registered) {
        throw new Error('Heartbeat socket is not connected or not registered');
    }

    activeSocket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
        type: 'runtime-heartbeat',
        ...payload
    });
};

const sendHeartbeat = async (): Promise<void> => {
    const metrics = await metricsService.collectSnapshot({
        cloudLatencyMs: lastCloudLatencyMs,
        connectedToCloud: registered
    });

    emitHeartbeatEvent({
        teamClusterId: config.teamClusterId,
        daemonPassword: config.daemonPassword,
        runtime: runtimeConfig,
        metrics
    });
};

const probeCloudLatency = async (): Promise<void> => {
    const targetUrl = new URL(config.voltCloudUrl);
    const basePath = targetUrl.pathname === '/'
        ? ''
        : targetUrl.pathname.replace(/\/+$/g, '');
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const startedAt = Date.now();

    await new Promise<void>((resolve) => {
        const request = transport.request({
            method: 'HEAD',
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port ? Number(targetUrl.port) : undefined,
            path: `${basePath}${VOLT_HEALTHCHECK_PATH}${targetUrl.search}`,
            timeout: 5_000
        }, (response) => {
            response.resume();
            response.once('end', () => {
                lastCloudLatencyMs = Date.now() - startedAt;
                resolve();
            });
        });

        request.once('timeout', () => {
            lastCloudLatencyMs = null;
            request.destroy(new Error('Cloud latency probe timed out'));
        });

        request.once('error', () => {
            lastCloudLatencyMs = null;
            resolve();
        });

        request.end();
    });
};

const startLatencyProbe = (): void => {
    if (latencyProbeTimer) return;

    void probeCloudLatency();
    latencyProbeTimer = setInterval(() => {
        void probeCloudLatency();
    }, config.metricsIntervalMs);
    latencyProbeTimer.unref();
};

const start = (): void => {
    socket = io(config.voltCloudUrl, {
        autoConnect: true,
        forceNew: true,
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 30_000,
        randomizationFactor: 0.3
    });

    socket.on('connect', () => {
        socket?.emit(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, {
            teamClusterId: config.teamClusterId,
            daemonPassword: config.daemonPassword,
            channel: HEARTBEAT_CHANNEL
        });
    });

    socket.on(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, () => {
        registered = true;
        logger.info('Heartbeat plane connected to VoltCloud');
        scheduleHeartbeat(true);
    });

    socket.on('disconnect', (reason) => {
        registered = false;
        clearHeartbeatTimer();
        logger.warn(`Heartbeat plane disconnected (${reason})`);
    });

    socket.on('connect_error', (error) => {
        registered = false;
        clearHeartbeatTimer();
        logger.warn(`Heartbeat plane connection error: ${error.message}`);
    });

    startLatencyProbe();
};

const stop = (): void => {
    registered = false;
    clearHeartbeatTimer();
    if (latencyProbeTimer) {
        clearInterval(latencyProbeTimer);
        latencyProbeTimer = null;
    }
    socket?.removeAllListeners();
    socket?.close();
    socket = null;
};

process.on('message', (message: RuntimeConfigMessage) => {
    if (!message || message.type !== 'runtime-config') return;
    runtimeConfig = message.runtimeConfig;
});

process.once('SIGINT', () => {
    stop();
    process.exit(0);
});

process.once('SIGTERM', () => {
    stop();
    process.exit(0);
});

start();
