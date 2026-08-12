import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';
import type { AtomPageResult } from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import type { TrajectoryPreviewResult } from '@modules/trajectory/services/TrajectoryServiceTypes';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import { getTrajectoryRasterPreviewsPrefix } from '@shared/application/utilities/raster-storage-paths';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports/ITeamClusterObjectGatewayClient';
import type {
    TrajectoryFrame as TrajectoryFrameView,
    TrajectoryFrameSimulationCellEmbed
} from '@shared/contracts/types/Trajectory';

interface ReadTrajectoryPreviewInput{
    trajectoryId: string;
    storageClusterId: string;
    objectGatewayClient: ITeamClusterObjectGatewayClient;
    createOutput: (buffer: Buffer) => TrajectoryPreviewResult | Promise<TrajectoryPreviewResult>;
}

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
    })){
        if(key.endsWith('.png')){
            keys.push(key);
        }
    }

    return keys.sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))[0] ?? null;
};

const toSimulationCellEmbed = (cell: SimulationCell): TrajectoryFrameSimulationCellEmbed => ({
    _id: cell.id,
    boundingBox: cell.boundingBox as TrajectoryFrameSimulationCellEmbed['boundingBox'],
    geometry: cell.geometry as TrajectoryFrameSimulationCellEmbed['geometry'],
    team: cell.team,
    trajectory: cell.trajectory,
    timestep: cell.timestep,
    createdAt: cell.createdAt,
    updatedAt: cell.updatedAt
});

const toTrajectoryFrameView = (frame: TrajectoryFrame): TrajectoryFrameView => ({
    timestep: frame.timestep,
    natoms: frame.natoms,
    simulationCell: frame.simulationCellRef
        ? toSimulationCellEmbed(frame.simulationCellRef)
        : (frame.simulationCell ?? undefined)
});

export const readTrajectoryPreview = async (
    input: ReadTrajectoryPreviewInput
): Promise<TrajectoryPreviewResult | null> => {
    const previewKey = await firstSortedPreviewKey(
        input.objectGatewayClient,
        input.storageClusterId,
        input.trajectoryId
    );

    if(!previewKey){
        return null;
    }

    try{
        const buffer = await input.objectGatewayClient.getBuffer(
            input.storageClusterId,
            TEAM_CLUSTER_BUCKETS.RASTERIZER,
            previewKey
        );

        return await input.createOutput(buffer);
    }catch{
        return null;
    }
};

export const getTrajectoryFrames = async (trajectoryId: string): Promise<TrajectoryFrameView[]> => {
    const frames = await TrajectoryFrame.find({
        where: { trajectoryId },
        relations: { simulationCellRef: true },
        order: { timestep: 'ASC' }
    });

    return frames.map(toTrajectoryFrameView);
};

export const readAtomsPage = async (
    teamClusterId: string,
    trajectoryId: string,
    timestep: string | number,
    page: number,
    limit: number,
    analysisId?: string,
    ownerClusterId?: string
): Promise<AtomPageResult> => trajectoryNativeDaemonService.getAtomsPage({
    teamClusterId,
    trajectoryId,
    timestep,
    objectKey: buildTrajectoryDumpObjectName(trajectoryId, timestep),
    ownerClusterId,
    page,
    limit,
    analysisId
});
