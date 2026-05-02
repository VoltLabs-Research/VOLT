import type { Readable } from 'node:stream';
import type { TeamClusterRemoteExplorerInputDTO } from './common';

/**
 * Requests a downloadable stream for a selected remote explorer object.
 */
export type DownloadTeamClusterRemoteExplorerObjectInputDTO = TeamClusterRemoteExplorerInputDTO;

/**
 * Returns the download stream and response headers for the requested remote explorer object.
 */
export interface DownloadTeamClusterRemoteExplorerObjectOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}
