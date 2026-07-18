import mongoose from 'mongoose';

import TrajectoryFrameModel, { type TrajectoryFrameLean } from '@modules/trajectory/models/trajectory/TrajectoryFrameModel';
import type { TrajectoryFrame, TrajectoryFrameSimulationCellEmbed } from '@shared/contracts/types/Trajectory';

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

const isPopulatedSimulationCell = (value: unknown): value is SimulationCellPopulated => (
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

const mapFrameLean = (doc: TrajectoryFrameLeanWithPopulatedCell): TrajectoryFrame => ({
    timestep: doc.timestep,
    natoms: doc.natoms,
    simulationCell: doc.simulationCell
        ? (isPopulatedSimulationCell(doc.simulationCell)
            ? toPopulatedSimulationCell(doc.simulationCell)
            : doc.simulationCell.toString())
        : undefined
});

export const getTrajectoryFrames = async (trajectoryId: string): Promise<TrajectoryFrame[]> => {
    const docs = await TrajectoryFrameModel
        .find({ trajectoryId: new mongoose.Types.ObjectId(trajectoryId) })
        .sort({ timestep: 1 })
        .populate('simulationCell')
        .lean<TrajectoryFrameLeanWithPopulatedCell[]>()
        .exec();

    return docs.map(mapFrameLean);
};
