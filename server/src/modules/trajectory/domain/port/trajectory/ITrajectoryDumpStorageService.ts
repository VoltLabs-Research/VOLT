import { Readable } from 'node:stream';

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

    /**
     * Checks whether a specific timestep dump exists for a trajectory.
     *
     * For local storage, performs a lightweight stat against the local MinIO bucket.
     * For daemon-managed trajectories, queries the daemon cluster's object store.
     *
     * @param trajectoryId - The trajectory identifier.
     * @param timestep - The dump timestep to check.
     * @returns `true` if the dump object exists, `false` otherwise.
     */
    existsDump(trajectoryId: string, timestep: string): Promise<boolean>;
};
