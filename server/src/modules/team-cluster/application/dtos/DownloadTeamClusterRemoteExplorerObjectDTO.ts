import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterRemoteAccessTargetDTO } from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { Readable } from 'node:stream';

/**
 * Requests a downloadable stream for a selected remote explorer object.
 */
export interface DownloadTeamClusterRemoteExplorerObjectInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
};

/**
 * Returns the download stream and response headers for the requested remote explorer object.
 */
export interface DownloadTeamClusterRemoteExplorerObjectOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
};
