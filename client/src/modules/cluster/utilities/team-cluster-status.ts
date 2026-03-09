import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';

export const getTeamClusterStatusLabel = (status: TeamClusterStatus): string => {
    switch (status) {
        case TeamClusterStatus.WaitingForConnection:
            return 'Waiting for connection';
        case TeamClusterStatus.HealthcheckReceived:
            return 'Healthcheck received';
        case TeamClusterStatus.PreparingEnvironment:
            return 'Preparing environment';
        case TeamClusterStatus.DependenciesInstallationFailed:
            return 'Dependency install failed';
        case TeamClusterStatus.OperatingSystemNotSupported:
            return 'OS not supported';
        case TeamClusterStatus.Connected:
            return 'Connected';
        case TeamClusterStatus.Disconnected:
            return 'Disconnected';
        case TeamClusterStatus.Deleting:
            return 'Deleting';
        case TeamClusterStatus.DeleteFailed:
            return 'Delete failed';
    }
};

export const getTeamClusterStatusVariant = (status: TeamClusterStatus): 'success' | 'warning' | 'danger' | 'inactive' => {
    switch (status) {
        case TeamClusterStatus.Connected:
            return 'success';
        case TeamClusterStatus.WaitingForConnection:
        case TeamClusterStatus.HealthcheckReceived:
        case TeamClusterStatus.PreparingEnvironment:
        case TeamClusterStatus.Deleting:
            return 'warning';
        case TeamClusterStatus.DependenciesInstallationFailed:
        case TeamClusterStatus.OperatingSystemNotSupported:
        case TeamClusterStatus.DeleteFailed:
            return 'danger';
        case TeamClusterStatus.Disconnected:
            return 'inactive';
    }
};

export const getTeamClusterStatusDescription = (status: TeamClusterStatus): string | null => {
    switch (status) {
        case TeamClusterStatus.Deleting:
            return 'Volt has requested uninstall and is waiting for runtime confirmation or disconnect evidence before removing the cluster.';
        case TeamClusterStatus.DeleteFailed:
            return 'The runtime reported that uninstall failed. Review the host and retry deletion when ready.';
        case TeamClusterStatus.Disconnected:
            return 'The daemon is offline, so Volt cannot guarantee remote cleanup until the cluster reconnects.';
        default:
            return null;
    }
};
