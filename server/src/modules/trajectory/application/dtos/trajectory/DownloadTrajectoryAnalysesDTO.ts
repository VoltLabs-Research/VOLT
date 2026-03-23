import type { Readable } from 'node:stream';

export interface DownloadTrajectoryAnalysesInputDTO {
    trajectoryId: string;
    teamId: string;
    name?: string;
}

export interface DownloadTrajectoryAnalysesOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}
