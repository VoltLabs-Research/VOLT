/**
 * Pure cross-module helpers for building/parsing raster object-storage keys
 * (trajectory previews, analysis raster frames). Canonical home in the neutral
 * `shared` layer (detachable-modules migration) so the trajectory module can
 * build a raster preview prefix without importing `@modules/raster`. No module
 * code is imported — these are string builders/parsers only.
 *
 * The original `@modules/raster/utilities/raster-storage-paths` re-exports
 * these for backward compatibility.
 */
export const getTrajectoryModelsPrefix = (trajectoryId: string): string => {
    return `trajectory-${trajectoryId}/`;
};

export const getTrajectoryRasterPreviewsPrefix = (trajectoryId: string): string => {
    return `${getTrajectoryModelsPrefix(trajectoryId)}previews/`;
};

export const getAnalysisRasterPreviewsPrefix = (trajectoryId: string, analysisId: string): string => {
    return `trajectory-${trajectoryId}/analysis-${analysisId}/raster/`;
};

export const getRasterFrameObjectName = (trajectoryId: string, timestep: number): string => {
    return `${getTrajectoryRasterPreviewsPrefix(trajectoryId)}timestep-${timestep}.png`;
};

export const getAnalysisRasterFrameObjectName = (
    trajectoryId: string,
    analysisId: string,
    timestep: number,
    model: string
): string => {
    return `${getAnalysisRasterPreviewsPrefix(trajectoryId, analysisId)}${timestep}_${model}.png`;
};

export const parseRasterTimestep = (fileKey: string): number | null => {
    const fileName = fileKey.split('/').pop();
    if (!fileName) {
        return null;
    }

    const match = fileName.match(/^timestep-(\d+)\.png$/);

    if (!match) {
        return null;
    }

    const timestep = Number.parseInt(match[1], 10);
    return Number.isInteger(timestep) ? timestep : null;
};

export interface ParsedAnalysisRasterFrameKey {
    timestep: number;
    model: string;
}

export const parseAnalysisRasterFrameKey = (fileKey: string): ParsedAnalysisRasterFrameKey | null => {
    const fileName = fileKey.split('/').pop();
    if (!fileName) {
        return null;
    }

    const match = fileName.match(/^(\d+)_(.+)\.png$/);
    if (!match) {
        return null;
    }

    const timestep = Number.parseInt(match[1], 10);
    if (!Number.isInteger(timestep)) {
        return null;
    }

    return {
        timestep,
        model: match[2]
    };
};
