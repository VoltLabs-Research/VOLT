import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import TeamClusterObjectGatewayClient from './TeamClusterObjectGatewayClient';

import type { IClusterObjectArchiveService } from '@modules/cluster/domain/port/IClusterObjectArchiveService';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

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

export type ClusterArchiveDownload = DownloadStreamOutputDTO & {
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

@Singleton(CLUSTER_TOKENS.ClusterObjectArchiveService)
export default class ClusterObjectArchiveService implements IClusterObjectArchiveService {
    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

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
