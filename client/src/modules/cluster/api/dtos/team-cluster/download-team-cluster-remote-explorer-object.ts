import type { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';

/**
 * Input parameters for downloading a remote explorer object as a file.
 * Path params (`teamId`, `teamClusterId`) are extracted by the SDK;
 * the remaining properties are sent as the POST body.
 */
export interface DownloadTeamClusterRemoteExplorerObjectInputDTO {
    teamId: string;
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
};
