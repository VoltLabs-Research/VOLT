export type TrajectoryCloneJobState =
    | 'queued'
    | 'preparing'
    | 'copying'
    | 'completed'
    | 'failed';

export interface TrajectoryCloneJobStats {
    totalFrames: number;
    copiedFrames: number;
    copiedBytes: number;
};

export interface TrajectoryCloneJobProps {
    team: string;
    sourceTrajectoryId: string;
    destinationTrajectoryId: string;
    sourceClusterId?: string | null;
    destinationClusterId: string;
    state: TrajectoryCloneJobState;
    stats: TrajectoryCloneJobStats;
    requestedBy: string;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export const createDefaultTrajectoryCloneJobStats = (): TrajectoryCloneJobStats => ({
    totalFrames: 0,
    copiedFrames: 0,
    copiedBytes: 0
});

export const createTrajectoryCloneJobProps = (
    input: {
        team: string;
        sourceTrajectoryId: string;
        destinationTrajectoryId: string;
        sourceClusterId?: string | null;
        destinationClusterId: string;
        state?: TrajectoryCloneJobState;
        stats?: Partial<TrajectoryCloneJobStats>;
        requestedBy: string;
        errorCode?: string | null;
        errorMessage?: string | null;
        startedAt?: Date | null;
        finishedAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
    }
): TrajectoryCloneJobProps => {
    const now = input.createdAt ?? input.updatedAt ?? new Date();
    const defaultStats = createDefaultTrajectoryCloneJobStats();

    return {
        team: input.team,
        sourceTrajectoryId: input.sourceTrajectoryId,
        destinationTrajectoryId: input.destinationTrajectoryId,
        sourceClusterId: input.sourceClusterId ?? null,
        destinationClusterId: input.destinationClusterId,
        state: input.state ?? 'queued',
        stats: {
            totalFrames: input.stats?.totalFrames ?? defaultStats.totalFrames,
            copiedFrames: input.stats?.copiedFrames ?? defaultStats.copiedFrames,
            copiedBytes: input.stats?.copiedBytes ?? defaultStats.copiedBytes
        },
        requestedBy: input.requestedBy,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now
    };
};

export default class TrajectoryCloneJob {
    constructor(
        public readonly _id: string,
        public props: TrajectoryCloneJobProps
    ) {}

    get id(): string {
        return this._id;
    }
};
