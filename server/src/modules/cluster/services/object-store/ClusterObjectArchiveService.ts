import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';

import type { IClusterObjectArchiveService } from '@shared/contracts/ports';
import type { DownloadStreamOutput } from '@shared/contracts/types';

interface ClusterArchiveObjectEntry {
    type: 'object';
    name: string;
    bucket: string;
    objectKey: string;
    ownerClusterId?: string;
    optional?: boolean;
}

interface ClusterArchiveInlineEntry {
    type: 'inline';
    name: string;
    content: string;
    encoding?: BufferEncoding;
}

type ClusterArchiveEntry = ClusterArchiveObjectEntry | ClusterArchiveInlineEntry;

interface ClusterArchiveReference {
    teamClusterId: string;
    bucket: string;
    objectKey: string;
}

type ClusterArchiveDownload = DownloadStreamOutput & {
    clusterObject: ClusterArchiveReference;
};

interface CreateArchiveDownloadInput {
    teamClusterId: string;
    entries: ClusterArchiveEntry[];
    outputObjectKey: string;
    outputBucket?: string;
    filename: string;
    cacheControl?: string;
}

export default class ClusterObjectArchiveService implements IClusterObjectArchiveService {
        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    private readonly objectGatewayClient = objectGatewayClient;

    async createArchiveDownload(input: CreateArchiveDownloadInput): Promise<ClusterArchiveDownload> {
        const bucket = input.outputBucket || TEAM_CLUSTER_BUCKETS.TRAJECTORIES;

        await this.teamClusterDaemonClient.command(
            input.teamClusterId,
            ChannelCommands.ObjectStoreArchiveCreate,
            {
                output: {
                    bucket,
                    objectKey: input.outputObjectKey
                },
                entries: input.entries
            },
            { timeoutClass: 'long-running-control-plane' }
        );

        const response = await this.objectGatewayClient.getStream(
            input.teamClusterId,
            bucket,
            input.outputObjectKey,
            { skipMetadata: true }
        );
        const download = createDownloadStreamResponse({
            stream: response.stream,
            contentType: response.contentType || 'application/zip',
            filename: input.filename,
            contentLength: response.contentLength,
            cacheControl: input.cacheControl || 'no-cache'
        });

        return {
            ...download,
            clusterObject: {
                teamClusterId: input.teamClusterId,
                bucket,
                objectKey: input.outputObjectKey
            }
        };
    }
}
