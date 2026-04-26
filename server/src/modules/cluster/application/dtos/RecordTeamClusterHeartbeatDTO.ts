import type { TeamClusterRuntimeRoleConfigProps } from '@modules/cluster/domain/entities/TeamCluster';
import type { TeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';

export interface RecordTeamClusterHeartbeatInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    runtime?: {
        roleConfig: TeamClusterRuntimeRoleConfigProps;
    };
    metrics?: TeamClusterHeartbeatMetricsDTO;
};

export interface TeamClusterHeartbeatMetricsDTO {
    timestamp: string;
    hostname: string;
    uptimeSeconds: number;
    cpuUsagePercent: number;
    cpuLoadAverage: number[];
    cpuPerCoreUsagePercent: number[];
    memory: {
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usagePercent: number;
    };
    disk: {
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usagePercent: number;
    };
    diskOperations: {
        readMegabytesPerSecond: number;
        writeMegabytesPerSecond: number;
        readIOPS: number;
        writeIOPS: number;
        totalIOPS: number;
    };
    network: {
        incomingKilobytesPerSecond: number;
        outgoingKilobytesPerSecond: number;
        totalKilobytesPerSecond: number;
        receivedBytes: number;
        sentBytes: number;
    };
    cloudLatencyMs: number | null;
    connectedToCloud: boolean;
};

export interface RecordTeamClusterHeartbeatOutputDTO {
    teamCluster: TeamClusterDTO;
};
