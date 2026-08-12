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

export const toTrajectoryRecord = (trajectory: Trajectory): TrajectoryRecord => (
    trajectory.toJSON() as unknown as TrajectoryRecord
);

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
