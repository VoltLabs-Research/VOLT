import { Readable } from 'node:stream';

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

    listDumps(trajectoryId: string): Promise<string[]>;

    existsDump(trajectoryId: string, timestep: string): Promise<boolean>;
}
