import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { getTrajectoryRasterPreviewsPrefix } from '@shared/application/utilities/raster-storage-paths';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type { GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/dtos/trajectory/GetTrajectoryPreviewDTO';

type PreviewOutputFactory = (
    buffer: Buffer
) => GetTrajectoryPreviewOutputDTO | Promise<GetTrajectoryPreviewOutputDTO>;

interface ReadTrajectoryPreviewInput {
    trajectoryId: string;
    storageClusterId: string;
    objectGatewayClient: ITeamClusterObjectGatewayClient;
    createOutput: PreviewOutputFactory;
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
    })) {
        if (key.endsWith('.png')) {
            keys.push(key);
        }
    }

    return keys.sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))[0] ?? null;
};

export const readTrajectoryPreview = async (
    input: ReadTrajectoryPreviewInput
): Promise<GetTrajectoryPreviewOutputDTO | null> => {
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
