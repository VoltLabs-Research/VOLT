import { MODEL_OBJECT_SUFFIX } from '@shared/utilities/model-stream';

const TRAJECTORY_DUMP_ZSTD_EXTENSION = '.dump.zst';

export const buildTrajectoryDumpObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${TRAJECTORY_DUMP_ZSTD_EXTENSION}`
);

export const buildTrajectoryGlbObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${MODEL_OBJECT_SUFFIX}`
);
