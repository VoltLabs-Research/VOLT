import type { TeamClusterRemoteAccessTarget } from '@volt/contracts/modules/cluster/domain';

export interface TeamClusterRemoteAccessSessionView {
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    createdAt: string;
    expiresAt: string;
}
