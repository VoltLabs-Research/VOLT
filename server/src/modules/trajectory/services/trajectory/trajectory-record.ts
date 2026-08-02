import { getTrajectoryFrameSummaries } from '@modules/trajectory/services/trajectory/TrajectoryFrameStore';

import type Trajectory from '@modules/trajectory/models/Trajectory';
import type { TrajectoryRecord } from '@modules/trajectory/services/TrajectoryServiceTypes';

const USER_SELECTION = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true
} as const;

const CLUSTER_NAME_SELECTION = {
    id: true,
    name: true
} as const;

/** Listings hydrate the author and the owning cluster so the client can name both. */
export const LISTING_RELATIONS = {
    relations: {
        createdByRef: true,
        storageClusterIdRef: true
    },
    select: {
        createdByRef: USER_SELECTION,
        storageClusterIdRef: CLUSTER_NAME_SELECTION
    }
} as const;

/** Public discovery answers with the columns a guest is allowed to see. */
export const PUBLIC_LISTING_SELECTION = {
    id: true,
    name: true,
    team: true,
    status: true,
    isPublic: true,
    hasPreview: true,
    stats: true,
    createdAt: true,
    updatedAt: true
} as const;

/**
 * The only entity -> wire projection for trajectories.
 *
 * `BaseModel.toJSON()` is declared as `Record<string, unknown>` rather than the
 * row's own shape, so the projection has to be re-asserted. It is asserted here
 * once: when `toJSON()` becomes typed, this is the single line to delete.
 */
export const toTrajectoryRecord = (trajectory: Trajectory): TrajectoryRecord => (
    trajectory.toJSON() as unknown as TrajectoryRecord
);

/**
 * Frame counts live in a separate table, so listings decorate each row with a
 * batched summary instead of hydrating frames.
 */
export const withFrameSummaries = async (trajectories: Trajectory[]): Promise<TrajectoryRecord[]> => {
    const summaries = await getTrajectoryFrameSummaries(trajectories.map((trajectory) => trajectory.id));

    return trajectories.map((trajectory) => {
        const view = toTrajectoryRecord(trajectory);
        const summary = summaries.get(trajectory.id);
        view.framesCount = summary?.framesCount ?? 0;
        view.atoms = summary?.atoms ?? 0;
        view.firstTimestep = summary?.firstTimestep;
        return view;
    });
};
