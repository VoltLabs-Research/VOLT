interface TeamClusterIdentifier {
    _id?: string;
};

interface TrajectoryPreviewAvailabilityProps {
    _id: string;
    storageClusterId?: string | TeamClusterIdentifier | null;
    teamCluster?: string | TeamClusterIdentifier | null;
};

const getTeamClusterId = (teamCluster: string | TeamClusterIdentifier | null | undefined): string | undefined => {
    if (typeof teamCluster === 'string' && teamCluster.length > 0) {
        return teamCluster;
    }

    if (typeof teamCluster === 'object' && teamCluster !== null && typeof teamCluster._id === 'string' && teamCluster._id.length > 0) {
        return teamCluster._id;
    }

    return undefined;
};

/** Resolves persisted preview availability from raster storage. */
export const resolveTrajectoryPreviewAvailability = async <TTrajectory extends TrajectoryPreviewAvailabilityProps>(
    trajectory: TTrajectory,
    hasTrajectoryPreview: (trajectoryId: string, teamClusterId?: string) => Promise<boolean>
): Promise<TTrajectory & { hasPreview: boolean; }> => {
    const teamClusterId = getTeamClusterId(trajectory.storageClusterId) ?? getTeamClusterId(trajectory.teamCluster);
    const hasPreview = await hasTrajectoryPreview(trajectory._id, teamClusterId);

    return {
        ...trajectory,
        hasPreview
    };
};
