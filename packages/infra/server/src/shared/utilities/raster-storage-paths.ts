
const getTrajectoryModelsPrefix = (trajectoryId: string): string => {
    return `trajectory-${trajectoryId}/`;
};

export const getTrajectoryRasterPreviewsPrefix = (trajectoryId: string): string => {
    return `${getTrajectoryModelsPrefix(trajectoryId)}previews/`;
};


