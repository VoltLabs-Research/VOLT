import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { getTrajectoryRasterPreviewsPrefix } from '@modules/raster/utilities/raster-storage-paths';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';

type PreviewOutputFactory = (
    buffer: Buffer
) => GetTrajectoryPreviewOutputDTO | Promise<GetTrajectoryPreviewOutputDTO>;

interface ReadTrajectoryPreviewInput {
    trajectoryId: string;
    storageClusterId: string;
    objectGatewayClient: TeamClusterObjectGatewayClient;
    createOutput: PreviewOutputFactory;
}

const firstSortedPreviewKey = async (
    objectGatewayClient: TeamClusterObjectGatewayClient,
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

const readRemotePreview = async (
    input: ReadTrajectoryPreviewInput,
    teamClusterId: string
): Promise<GetTrajectoryPreviewOutputDTO | null> => {
    const previewKey = await firstSortedPreviewKey(
        input.objectGatewayClient,
        teamClusterId,
        input.trajectoryId
    );

    if (!previewKey) {
        return null;
    }

    const buffer = await input.objectGatewayClient.getBuffer(
        teamClusterId,
        TEAM_CLUSTER_BUCKETS.RASTERIZER,
        previewKey
    );

    return input.createOutput(buffer);
};

export const readTrajectoryPreview = async (
    input: ReadTrajectoryPreviewInput
): Promise<GetTrajectoryPreviewOutputDTO | null> => {
    return readRemotePreview(input, input.storageClusterId);
};
