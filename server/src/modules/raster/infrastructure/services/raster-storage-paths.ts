export const getTrajectoryModelsPrefix = (trajectoryId: string): string => {
    return `trajectory-${trajectoryId}/`;
};

export const getTrajectoryRasterPreviewsPrefix = (trajectoryId: string): string => {
    return `${getTrajectoryModelsPrefix(trajectoryId)}previews/`;
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
    return `trajectory-${trajectoryId}/analysis-${analysisId}/raster/${timestep}_${model}.png`;
};

export const parseRasterTimestep = (fileKey: string): number | null => {
    const match = fileKey.match(/(\d+)(?=\.glb$)/);

    if (!match) {
        return null;
    }

    const timestep = Number.parseInt(match[0], 10);
    return Number.isInteger(timestep) ? timestep : null;
};
