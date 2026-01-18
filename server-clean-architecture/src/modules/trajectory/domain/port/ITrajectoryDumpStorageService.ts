import { Readable } from 'node:stream';

export interface PreviewStream{
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

    saveDump(
        trajectoryId: string,
        timestep: string,
        data: Buffer | string,
        onProgress?: (progress: number) => void
    ): Promise<string>;

    getDump(
        trajectoryId: string,
        timestep: string
    ): Promise<string | null>;

    calculateSize(trajectoryId: string): Promise<number>;

    getDumpStream(
        trajectoryId: string,
        timestep: string
    ): Promise<Readable>;

    listDumps(trajectoryId: string): Promise<string[]>;

    deleteDumps(trajectoryId: string): Promise<void>;
};