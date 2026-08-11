import type Trajectory from '@modules/trajectory/models/Trajectory';
import type { TrajectoryLike } from '@shared/contracts/types/Trajectory';

/** Wraps a trajectory row in the `{ _id, props }` shape the daemon contracts use. */
export const toTrajectoryLike = (trajectory: Trajectory): TrajectoryLike => ({
    _id: trajectory.id,
    props: {
        name: trajectory.name,
        team: trajectory.team,
        folder: trajectory.folder,
        storageClusterId: trajectory.storageClusterId,
        createdBy: trajectory.createdBy,
        status: trajectory.status,
        isPublic: trajectory.isPublic,
        hasPreview: trajectory.hasPreview,
        stats: trajectory.stats,
        updatedAt: trajectory.updatedAt,
        createdAt: trajectory.createdAt
    }
});
