import { Readable } from 'node:stream';

export interface TrajectoryDumpStreamResponse {
    stream: Readable;
    objectName: string;
    contentLength?: number;
    contentEncoding?: string;
}

export interface ITrajectoryDumpStorageService{
    getObjectName(
        trajectoryId: string,
        timestep: string
    ): string;

    getPrefix(trajectoryId: string): string;

    getDumpStream(
        trajectoryId: string,
        timestep: string
    ): Promise<Readable>;

    getDumpResponse(
        trajectoryId: string,
        timestep: string
    ): Promise<TrajectoryDumpStreamResponse>;

    listDumps(trajectoryId: string): Promise<string[]>;

    existsDump(trajectoryId: string, timestep: string): Promise<boolean>;
}
