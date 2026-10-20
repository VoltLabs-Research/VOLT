import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import { createDownloadStreamResponse } from '@shared/http/responses/download-response';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';

import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';

export interface ClusterArchiveObjectEntry {
    type: 'object';
    name: string;
    bucket: string;
    objectKey: string;
    ownerClusterId?: string;
    optional?: boolean;
}

export interface ClusterArchiveInlineEntry {
    type: 'inline';
    name: string;
    content: string;
    encoding?: BufferEncoding;
}

export type ClusterArchiveEntry = ClusterArchiveObjectEntry | ClusterArchiveInlineEntry;

export interface ClusterArchiveReference {
    teamClusterId: string;
    bucket: string;
    objectKey: string;
}

export type ClusterArchiveDownload = DownloadStreamOutput & {
    clusterObject: ClusterArchiveReference;
};

export interface CreateArchiveDownloadInput {
    teamClusterId: string;
    entries: ClusterArchiveEntry[];
    outputObjectKey: string;
    outputBucket?: string;
    filename: string;
    cacheControl?: string;
}

class ClusterObjectArchiveService {
    async createArchiveDownload(input: CreateArchiveDownloadInput): Promise<ClusterArchiveDownload> {
        const bucket = input.outputBucket || TEAM_CLUSTER_BUCKETS.TRAJECTORIES;

        await teamClusterDaemonClient.command(
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

        const response = await objectGatewayClient.getStream(
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

export default new ClusterObjectArchiveService();
