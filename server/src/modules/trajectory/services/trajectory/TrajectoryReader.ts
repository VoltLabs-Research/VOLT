import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import TrajectoryFrameModel, {
    type TrajectoryFrameLean
} from '@modules/trajectory/models/trajectory/TrajectoryFrameModel';
import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';
import type { AtomPageResult } from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import type { TrajectoryPreviewResult } from '@modules/trajectory/services/TrajectoryServiceTypes';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { getTrajectoryRasterPreviewsPrefix } from '@shared/application/utilities/raster-storage-paths';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type {
    TrajectoryFrame,
    TrajectoryFrameSimulationCellEmbed
} from '@shared/contracts/types/Trajectory';
import mongoose from 'mongoose';

type PreviewOutputFactory = (
    buffer: Buffer
) => TrajectoryPreviewResult | Promise<TrajectoryPreviewResult>;

interface ReadTrajectoryPreviewInput {
    trajectoryId: string;
    storageClusterId: string;
    objectGatewayClient: ITeamClusterObjectGatewayClient;
    createOutput: PreviewOutputFactory;
}

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

const firstSortedPreviewKey = async (
    objectGatewayClient: ITeamClusterObjectGatewayClient,
    teamClusterId: string,
    trajectoryId: string
): Promise<string | null> => {
    const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);
    const keys: string[] = [];

    for await (const key of objectGatewayClient.listAll(teamClusterId, {
        bucket: TEAM_CLUSTER_BUCKETS.RASTERIZER,
        prefix
    })) {
        if (key.endsWith('.png')) {
            keys.push(key);
        }
    }

    return keys.sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))[0] ?? null;
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

export const readTrajectoryPreview = async (
    input: ReadTrajectoryPreviewInput
): Promise<TrajectoryPreviewResult | null> => {
    const previewKey = await firstSortedPreviewKey(
        input.objectGatewayClient,
        input.storageClusterId,
        input.trajectoryId
    );

    if (!previewKey) {
        return null;
    }

    const buffer = await input.objectGatewayClient.getBuffer(
        input.storageClusterId,
        TEAM_CLUSTER_BUCKETS.RASTERIZER,
        previewKey
    );

    return input.createOutput(buffer);
};

export const getTrajectoryFrames = async (trajectoryId: string): Promise<TrajectoryFrame[]> => {
    const docs = await TrajectoryFrameModel
        .find({ trajectoryId: new mongoose.Types.ObjectId(trajectoryId) })
        .sort({ timestep: 1 })
        .populate('simulationCell')
        .lean<TrajectoryFrameLeanWithPopulatedCell[]>()
        .exec();

    return docs.map(mapFrameLean);
};

export class TrajectoryReader {
    async readPage(
        teamClusterId: string | undefined,
        trajectoryId: string,
        timestep: string | number,
        page: number,
        limit: number,
        analysisId?: string,
        ownerClusterId?: string
    ): Promise<AtomPageResult> {
        if (!teamClusterId) {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_TEAM_CLUSTER_REQUIRED,
                `Trajectory ${trajectoryId} must be associated with a team cluster to read atoms`
            );
        }

        return trajectoryNativeDaemonService.getAtomsPage({
            teamClusterId,
            trajectoryId,
            timestep,
            objectKey: this.getDumpObjectKey(trajectoryId, timestep),
            ownerClusterId,
            page,
            limit,
            analysisId
        });
    }

    private getDumpObjectKey(trajectoryId: string, timestep: string | number): string {
        return buildTrajectoryDumpObjectName(trajectoryId, timestep);
    }
}

export default new TrajectoryReader();
