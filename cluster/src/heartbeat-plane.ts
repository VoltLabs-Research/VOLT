import { errorMessage } from '@shared/application/utilities/error-message';
import { type Socket } from 'socket.io-client';
import http from 'node:http';
import https from 'node:https';

import { loadConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import { MetricsService } from '@modules/system/services/MetricsService';
import { probeContainerRuntime } from '@shared/infrastructure/runtime/docker-client';
import type { MetricsSnapshot } from '@shared/contracts/types/metrics';
import type { TeamClusterDaemonRuntimeConfig, TeamClusterHostCapabilities } from '@shared/contracts/types/team-cluster-runtime';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    connectPlaneSocket,
    registerSignalHandlers
} from '@shared/infrastructure/planes/plane-shared';

interface RuntimeConfigMessage {
    type: 'runtime-config';
    runtimeConfig: TeamClusterDaemonRuntimeConfig | null;
}

interface HeartbeatPayload {
    teamClusterId: string;
    daemonPassword: string;
    runtime: TeamClusterDaemonRuntimeConfig | null;
    metrics: MetricsSnapshot;
    hostCapabilities: TeamClusterHostCapabilities;
}

const HEARTBEAT_CHANNEL = 'heartbeat';
const VOLT_HEALTHCHECK_PATH = '/healthz';

const config = loadConfig();
const metricsService = new MetricsService();

let socket: Socket | null = null;
let isRegistered = (): boolean => false;
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
                logger.warn(`Heartbeat plane failed: ${errorMessage(error)}`);
            })
            .finally(() => {
                if (isRegistered()) {
                    scheduleHeartbeat(false);
                }
            });
    }, delay);
    heartbeatTimer.unref();
};

const emitHeartbeatEvent = (payload: HeartbeatPayload): void => {
    const activeSocket = socket;
    if (!activeSocket || !isRegistered()) {
        throw new Error('Heartbeat socket is not connected or not registered');
    }

    activeSocket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
        type: 'runtime-heartbeat',
        ...payload
    });
};

const sendHeartbeat = async (): Promise<void> => {
    const metrics = await metricsService.collectSnapshot({ cloudLatencyMs: lastCloudLatencyMs });

    emitHeartbeatEvent({
        teamClusterId: config.teamClusterId,
        daemonPassword: config.daemonPassword,
        runtime: runtimeConfig,
        metrics,
        hostCapabilities: {
            containerRuntime: await probeContainerRuntime()
        }
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
    const connection = connectPlaneSocket(
        config,
        {
            channel: HEARTBEAT_CHANNEL,
            label: 'Heartbeat plane'
        },
        {
            onRegistered: () => scheduleHeartbeat(true),
            onDisconnected: clearHeartbeatTimer,
            onError: clearHeartbeatTimer
        }
    );

    socket = connection.socket;
    isRegistered = connection.isRegistered;

    startLatencyProbe();
};

const stop = (): void => {
    isRegistered = () => false;
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

registerSignalHandlers(stop);

start();
