import TrajectoryFrameEntity from '@modules/trajectory/models/TrajectoryFrame';
import { generateEntityId } from '@shared/infrastructure/persistence/entity-id';

import type { TrajectoryFrame } from '@shared/contracts/types/Trajectory';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

interface TrajectoryFrameSummary {
    framesCount: number;
    atoms: number;
    firstTimestep: number;
}

const buildFrameRows = (
    trajectoryId: string,
    frames: TrajectoryFrame[]
): QueryDeepPartialEntity<TrajectoryFrameEntity>[] => frames.map((frame) => ({
    id: generateEntityId(),
    trajectoryId,
    timestep: frame.timestep,
    natoms: frame.natoms,
    simulationCell: (typeof frame.simulationCell === 'string'
        ? frame.simulationCell
        : frame.simulationCell?._id) ?? null
}));

/** Swaps a trajectory's whole frame set in one transaction. */
export const replaceTrajectoryFrames = async (trajectoryId: string, frames: TrajectoryFrame[]): Promise<void> => {
    const dataSource = TrajectoryFrameEntity.getRepository().manager.connection;

    await dataSource.transaction(async (manager) => {
        await manager.delete(TrajectoryFrameEntity, { trajectoryId });

        const rows = buildFrameRows(trajectoryId, frames);
        if (rows.length === 0) return;

        await manager.createQueryBuilder()
            .insert()
            .into(TrajectoryFrameEntity)
            .values(rows)
            .orIgnore()
            .execute();
    });
};

/**
 * Frame counts and first-frame atom totals for a page of trajectories, so
 * listings do not have to load every frame row.
 */
export const getTrajectoryFrameSummaries = async (
    trajectoryIds: string[]
): Promise<Map<string, TrajectoryFrameSummary>> => {
    const summaries = new Map<string, TrajectoryFrameSummary>();
    if (trajectoryIds.length === 0) return summaries;

    const counts = await TrajectoryFrameEntity.createQueryBuilder('frame')
        .select('frame.trajectoryId', 'trajectoryId')
        .addSelect('COUNT(frame.id)', 'framesCount')
        .addSelect('MIN(frame.timestep)', 'firstTimestep')
        .where('frame.trajectoryId IN (:...trajectoryIds)', { trajectoryIds })
        .groupBy('frame.trajectoryId')
        .getRawMany<{ trajectoryId: string; framesCount: string | number; firstTimestep: string | number }>();

    if (counts.length === 0) return summaries;

    const firstFrames = await TrajectoryFrameEntity.createQueryBuilder('frame')
        .select('frame.trajectoryId', 'trajectoryId')
        .addSelect('frame.natoms', 'natoms')
        .where('frame.trajectoryId IN (:...trajectoryIds)', { trajectoryIds })
        .andWhere(
            'frame.timestep = (SELECT MIN(earliest.timestep) FROM trajectory_frames earliest'
            + ' WHERE earliest."trajectoryId" = frame.trajectoryId)'
        )
        .getRawMany<{ trajectoryId: string; natoms: string | number }>();

    const atomsByTrajectory = new Map<string, number>();
    for (const row of firstFrames) {
        if (atomsByTrajectory.has(row.trajectoryId)) continue;
        atomsByTrajectory.set(row.trajectoryId, Number(row.natoms));
    }

    for (const row of counts) {
        summaries.set(row.trajectoryId, {
            framesCount: Number(row.framesCount),
            atoms: atomsByTrajectory.get(row.trajectoryId) ?? 0,
            firstTimestep: Number(row.firstTimestep)
        });
    }

    return summaries;
};
