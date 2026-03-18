import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

/**
 * Resolves the active cluster selection against the currently available clusters.
 */
export const resolveSelectedClusterId = (
    selectedClusterId: string | null,
    clusters: TeamCluster[]
): string | null => {
    if (!clusters.length) {
        return null;
    }

    const hasSelectedCluster = clusters.some((cluster) => cluster._id === selectedClusterId);
    if (hasSelectedCluster) {
        return selectedClusterId;
    }

    return clusters[0]._id;
};
