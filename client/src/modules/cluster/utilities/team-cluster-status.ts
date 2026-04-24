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
        case TeamClusterStatus.Updating:
            return 'Updating';
        case TeamClusterStatus.UpdateFailed:
            return 'Update failed';
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
        case TeamClusterStatus.UpdateFailed:
            return 'danger';
        case TeamClusterStatus.Disconnected:
            return 'inactive';
        case TeamClusterStatus.Updating:
            return 'warning';
    }
};

