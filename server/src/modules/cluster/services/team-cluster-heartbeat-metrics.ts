import type { SystemMetrics, SystemStatus } from '@modules/system/services/SystemMetrics';
import type { TeamClusterHeartbeatMetricsInput } from '@modules/cluster/socket/TeamClusterSocketProtocol';

const BYTES_PER_GB = 1024 ** 3;

const resolveSystemStatus = (metrics: TeamClusterHeartbeatMetricsInput): SystemStatus => {
    const cpuUsagePercent = metrics.cpuUsagePercent;
    const memoryUsagePercent = metrics.memory.usagePercent;
    const diskUsagePercent = metrics.disk.usagePercent;

    if (cpuUsagePercent >= 90 || memoryUsagePercent >= 90 || diskUsagePercent >= 90) {
        return 'Critical';
    }

    if (cpuUsagePercent >= 75 || memoryUsagePercent >= 75 || diskUsagePercent >= 85) {
        return 'Warning';
    }

    return 'Healthy';
};

export const toSystemMetricsFromHeartbeat = (
    teamClusterId: string,
    metrics: TeamClusterHeartbeatMetricsInput
): SystemMetrics => ({
    timestamp: new Date(metrics.timestamp),
    serverId: metrics.hostname,
    teamClusterId,
    cpu: {
        usage: metrics.cpuUsagePercent,
        cores: metrics.cpuPerCoreUsagePercent.length,
        loadAvg: metrics.cpuLoadAverage,
        coresUsage: metrics.cpuPerCoreUsagePercent
    },
    memory: {
        total: metrics.memory.totalBytes / BYTES_PER_GB,
        used: metrics.memory.usedBytes / BYTES_PER_GB,
        free: metrics.memory.freeBytes / BYTES_PER_GB,
        usagePercent: metrics.memory.usagePercent
    },
    disk: {
        total: metrics.disk.totalBytes / BYTES_PER_GB,
        used: metrics.disk.usedBytes / BYTES_PER_GB,
        free: metrics.disk.freeBytes / BYTES_PER_GB,
        usagePercent: metrics.disk.usagePercent
    },
    network: {
        incoming: metrics.network.incomingKilobytesPerSecond,
        outgoing: metrics.network.outgoingKilobytesPerSecond,
        total: metrics.network.totalKilobytesPerSecond
    },
    responseTime: metrics.cloudLatencyMs ?? 0,
    responseTimes: {
        postgres: 0,
        self: metrics.cloudLatencyMs ?? 0,
        average: metrics.cloudLatencyMs ?? 0
    },
    diskOperations: {
        read: metrics.diskOperations.readMegabytesPerSecond,
        write: metrics.diskOperations.writeMegabytesPerSecond,
        speed: metrics.diskOperations.totalIOPS,
        readIOPS: metrics.diskOperations.readIOPS,
        writeIOPS: metrics.diskOperations.writeIOPS
    },
    status: resolveSystemStatus(metrics),
    uptime: metrics.uptimeSeconds,
    postgres: {
        connections: 0,
        queries: 0,
        latency: 0
    }
});
