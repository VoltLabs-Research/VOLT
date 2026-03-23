import type { Readable } from 'node:stream';

export interface DownloadTrajectoryInputDTO {
    trajectoryId: string;
    teamId: string;
    userId: string;
    name?: string;
    archive?: boolean;
};

export interface DownloadTrajectoryOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
};
