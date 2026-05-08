import TrajectoryFrameModel, {
    TrajectoryFrameLean
} from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryFrameModel';
import { Singleton } from '@shared/infrastructure/di/decorators';

import mongoose from 'mongoose';


import type { TrajectoryFrame, TrajectoryFrameSimulationCellEmbed } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface GetFramesOptions {
    from?: number;
    to?: number;
    limit?: number;
    skip?: number;
}

const toObjectId = (value: string): mongoose.Types.ObjectId => (
    new mongoose.Types.ObjectId(value)
);

interface SimulationCellPopulated {
    _id: mongoose.Types.ObjectId | string;
    boundingBox: { width: number; height: number; length: number };
    geometry: {
        cell_vectors: number[][];
        cell_origin: number[];
        periodic_boundary_conditions: { x: boolean; y: boolean; z: boolean };
    };
    team?: mongoose.Types.ObjectId | string;
    trajectory?: mongoose.Types.ObjectId | string;
    timestep: number;
    createdAt?: Date;
    updatedAt?: Date;
}

type TrajectoryFrameLeanWithPopulatedCell = Omit<TrajectoryFrameLean, 'simulationCell'> & {
    simulationCell: SimulationCellPopulated | mongoose.Types.ObjectId;
};

const isPopulated = (value: unknown): value is SimulationCellPopulated => (
    typeof value === 'object' && value !== null && 'boundingBox' in value && 'geometry' in value
);

const toPopulatedSimulationCell = (value: SimulationCellPopulated): TrajectoryFrameSimulationCellEmbed => ({
    _id: value._id.toString(),
    boundingBox: value.boundingBox,
    geometry: value.geometry,
    team: value.team?.toString(),
    trajectory: value.trajectory?.toString(),
    timestep: value.timestep,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
});

const mapLean = (doc: TrajectoryFrameLeanWithPopulatedCell): TrajectoryFrame => ({
    timestep: doc.timestep,
    natoms: doc.natoms,
    simulationCell: isPopulated(doc.simulationCell)
        ? toPopulatedSimulationCell(doc.simulationCell)
        : doc.simulationCell.toString()
});

@Singleton()
export default class TrajectoryFrameRepository {
    async getFrames(trajectoryId: string, options: GetFramesOptions = {}): Promise<TrajectoryFrame[]> {
        const filter: Record<string, unknown> = {
            trajectoryId: toObjectId(trajectoryId)
        };

        if (options.from !== undefined || options.to !== undefined) {
            const range: Record<string, number> = {};
            if (options.from !== undefined) range.$gte = options.from;
            if (options.to !== undefined) range.$lte = options.to;
            filter.timestep = range;
        }

        let query = TrajectoryFrameModel
            .find(filter)
            .sort({ timestep: 1 })
            .populate('simulationCell');
        if (options.skip) query = query.skip(options.skip);
        if (options.limit) query = query.limit(options.limit);

        const docs = await query.lean<TrajectoryFrameLeanWithPopulatedCell[]>().exec();
        return docs.map(mapLean);
    }

    async countFrames(trajectoryId: string): Promise<number> {
        return TrajectoryFrameModel.countDocuments({ trajectoryId: toObjectId(trajectoryId) }).exec();
    }

    async getListingSummariesByTrajectoryIds(
        trajectoryIds: string[]
    ): Promise<Map<string, { framesCount: number; atoms: number; firstTimestep: number }>> {
        const summaries = new Map<string, { framesCount: number; atoms: number; firstTimestep: number }>();
        if (trajectoryIds.length === 0) return summaries;

        const rows = await TrajectoryFrameModel.aggregate<{
            _id: mongoose.Types.ObjectId;
            framesCount: number;
            atoms: number;
            firstTimestep: number;
        }>([
            { $match: { trajectoryId: { $in: trajectoryIds.map(toObjectId) } } },
            { $sort: { trajectoryId: 1, timestep: 1 } },
            {
                $group: {
                    _id: '$trajectoryId',
                    framesCount: { $sum: 1 },
                    atoms: { $first: '$natoms' },
                    firstTimestep: { $first: '$timestep' }
                }
            }
        ]).exec();

        for (const row of rows) {
            summaries.set(row._id.toString(), {
                framesCount: row.framesCount,
                atoms: row.atoms,
                firstTimestep: row.firstTimestep
            });
        }

        return summaries;
    }

    async insertFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void> {
        if (frames.length === 0) return;

        const documents = frames.map((frame) => {
            const simulationCellId = typeof frame.simulationCell === 'string'
                ? frame.simulationCell
                : frame.simulationCell._id;
            return {
                trajectoryId: toObjectId(trajectoryId),
                timestep: frame.timestep,
                natoms: frame.natoms,
                simulationCell: toObjectId(simulationCellId)
            };
        });

        // Why: `ordered: false` lets MongoDB finish the rest of the batch when a
        // duplicate (trajectoryId, timestep) is re-sent — idempotent from the
        // caller's perspective, no throw on the unique index collision.
        await TrajectoryFrameModel.collection.insertMany(documents, { ordered: false }).catch((error) => {
            if ((error as { code?: number }).code === 11000) return;
            throw error;
        });
    }

    async replaceFrames(trajectoryId: string, frames: TrajectoryFrame[]): Promise<void> {
        await TrajectoryFrameModel.deleteMany({ trajectoryId: toObjectId(trajectoryId) }).exec();
        await this.insertFrames(trajectoryId, frames);
    }

    async deleteByTrajectoryId(trajectoryId: string): Promise<number> {
        const result = await TrajectoryFrameModel.deleteMany({
            trajectoryId: toObjectId(trajectoryId)
        }).exec();
        return result.deletedCount ?? 0;
    }

    async findFrame(trajectoryId: string, timestep: number): Promise<TrajectoryFrame | null> {
        const doc = await TrajectoryFrameModel.findOne({
            trajectoryId: toObjectId(trajectoryId),
            timestep
        }).populate('simulationCell').lean<TrajectoryFrameLeanWithPopulatedCell>().exec();

        return doc ? mapLean(doc) : null;
    }
}
