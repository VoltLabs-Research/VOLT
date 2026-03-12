import { Readable } from 'node:stream';

interface PreviewStream{
    stream: NodeJS.ReadableStream;
    size: number;
    filename: string;
};

export interface ITrajectoryDumpStorageService{
    getObjectName(
        trajectoryId: string,
        timestep: string
    ): string;

    getPrefix(trajectoryId: string): string;

    getCachePath(
        trajectoryId: string,
        timestep: string
    ): string;

    getDump(
        trajectoryId: string,
        timestep: string
    ): Promise<string | null>;

    getDumpStream(
        trajectoryId: string,
        timestep: string
    ): Promise<Readable>;

    listDumps(trajectoryId: string): Promise<string[]>;
};
