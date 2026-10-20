const TRAJECTORY_DUMP_ZSTD_EXTENSION = '.dump.zst';
const TRAJECTORY_GLB_ZSTD_EXTENSION = '.glb.zst';

export const buildTrajectoryDumpObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${TRAJECTORY_DUMP_ZSTD_EXTENSION}`
);

export const buildTrajectoryGlbObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${TRAJECTORY_GLB_ZSTD_EXTENSION}`
);

const ZSTD_EXTENSION = '.zst';

export const stripTrailingZstdExtension = (objectName: string): string => (
    objectName.endsWith(ZSTD_EXTENSION)
        ? objectName.slice(0, -ZSTD_EXTENSION.length)
        : objectName
);
