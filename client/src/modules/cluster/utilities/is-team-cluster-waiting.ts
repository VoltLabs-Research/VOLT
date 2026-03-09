import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';

export const isTeamClusterWaiting = (status: TeamClusterStatus): boolean => {
    return status === TeamClusterStatus.WaitingForConnection
        || status === TeamClusterStatus.HealthcheckReceived
        || status === TeamClusterStatus.PreparingEnvironment;
};
