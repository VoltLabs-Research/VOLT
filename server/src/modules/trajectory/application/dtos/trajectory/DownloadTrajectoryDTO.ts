import type { Readable } from 'node:stream';

export interface DownloadTrajectoryInputDTO {
    trajectoryId: string;
    teamId: string;
    userId: string;
    name?: string;
};

export interface DownloadTrajectoryOutputDTO {
    stream: Readable;
    filename: string;
};
