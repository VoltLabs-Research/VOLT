import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';

export const isTeamClusterWaiting = (status: TeamClusterStatus): boolean => {
    return status === TeamClusterStatus.WaitingForConnection
        || status === TeamClusterStatus.HealthcheckReceived
        || status === TeamClusterStatus.PreparingEnvironment;
};
