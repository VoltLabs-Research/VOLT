export const TRAJECTORY_DUMP_ZSTD_EXTENSION = '.dump.zst';
export const TRAJECTORY_GLB_ZSTD_EXTENSION = '.glb.zst';

export const buildTrajectoryDumpObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${TRAJECTORY_DUMP_ZSTD_EXTENSION}`
);

export const buildTrajectoryGlbObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${TRAJECTORY_GLB_ZSTD_EXTENSION}`
);

export const isZstdObjectName = (objectName: string): boolean => objectName.endsWith('.zst');

export const stripTrailingZstdExtension = (objectName: string): string => (
    isZstdObjectName(objectName)
        ? objectName.slice(0, -'.zst'.length)
        : objectName
);
