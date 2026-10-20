import { isObjectNotFoundError } from '@shared/contracts/types/cluster-object-store';
import type { TrajectoryFrameLookupInput } from '@shared/contracts/types/trajectory-frame-store';

export const toTrajectoryFrameError = (error: unknown, input: TrajectoryFrameLookupInput): Error => {
    if (isObjectNotFoundError(error)) {
        const notFound = new Error(
            `Parquet trajectory object not found: trajectoryId=${input.trajectoryId}, timestep=${input.timestep}, ` +
            `ownerClusterId=${input.ownerClusterId}. The trajectory may not have been ingested yet.`
        );
        notFound.name = 'ParquetTrajectoryNotFoundError';
        return notFound;
    }
    if (error instanceof Error) return error;
    return new Error(String(error));
};
