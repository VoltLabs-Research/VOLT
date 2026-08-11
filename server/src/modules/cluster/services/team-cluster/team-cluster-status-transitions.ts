import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';

const TEAM_CLUSTER_ALLOWED_TRANSITIONS: Record<TeamClusterStatus, ReadonlySet<TeamClusterStatus>> = {
    [TeamClusterStatus.WaitingForConnection]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.Connected,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.HealthcheckReceived]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.Connected,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.PreparingEnvironment]: new Set([
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.Connected,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.DependenciesInstallationFailed]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.OperatingSystemNotSupported]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Connected]: new Set([
        TeamClusterStatus.Connected,
        TeamClusterStatus.Disconnected,
        TeamClusterStatus.Updating,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Disconnected]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Connected,
        TeamClusterStatus.Disconnected,
        TeamClusterStatus.Updating,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Deleting]: new Set([
        TeamClusterStatus.Deleting,
        TeamClusterStatus.DeleteFailed
    ]),
    [TeamClusterStatus.DeleteFailed]: new Set([
        TeamClusterStatus.DeleteFailed,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Updating]: new Set([
        TeamClusterStatus.Updating,
        TeamClusterStatus.Connected,
        TeamClusterStatus.UpdateFailed,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.UpdateFailed]: new Set([
        TeamClusterStatus.UpdateFailed,
        TeamClusterStatus.Updating,
        TeamClusterStatus.Connected,
        TeamClusterStatus.Deleting
    ])
};

/**
 * Statuses owned by an in-flight lifecycle operation: socket connectivity events
 * must not overwrite them, only the operation that set them may move on.
 */
export const HEARTBEAT_LOCKED_STATUSES = new Set<TeamClusterStatus>([
    TeamClusterStatus.Deleting,
    TeamClusterStatus.DeleteFailed,
    TeamClusterStatus.Updating,
    TeamClusterStatus.UpdateFailed
]);

export const isTeamClusterTransitionAllowed = (
    currentStatus: TeamClusterStatus,
    nextStatus: TeamClusterStatus
): boolean => {
    if (currentStatus === nextStatus) {
        return true;
    }

    return TEAM_CLUSTER_ALLOWED_TRANSITIONS[currentStatus].has(nextStatus);
};
