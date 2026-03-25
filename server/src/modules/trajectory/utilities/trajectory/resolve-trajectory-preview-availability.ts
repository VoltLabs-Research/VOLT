interface TeamClusterIdentifier {
    _id?: string;
};

interface TrajectoryPreviewAvailabilityProps {
    _id: string;
    storageClusterId?: string | TeamClusterIdentifier | null;
};

const getClusterReferenceId = (clusterReference: string | TeamClusterIdentifier | null | undefined): string | undefined => {
    if (typeof clusterReference === 'string' && clusterReference.length > 0) {
        return clusterReference;
    }

    if (
        typeof clusterReference === 'object'
        && clusterReference !== null
        && typeof clusterReference._id === 'string'
        && clusterReference._id.length > 0
    ) {
        return clusterReference._id;
    }

    return undefined;
};

/** Resolves persisted preview availability from raster storage. */
export const resolveTrajectoryPreviewAvailability = async <TTrajectory extends TrajectoryPreviewAvailabilityProps>(
    trajectory: TTrajectory,
    hasTrajectoryPreview: (trajectoryId: string, teamClusterId?: string) => Promise<boolean>
): Promise<TTrajectory & { hasPreview: boolean; }> => {
    const teamClusterId = getClusterReferenceId(trajectory.storageClusterId);
    const hasPreview = await hasTrajectoryPreview(trajectory._id, teamClusterId);

    return {
        ...trajectory,
        hasPreview
    };
};
