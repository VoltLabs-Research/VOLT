import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { createDownloadStreamResponse } from '@shared/http/responses/download-response';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';

import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import type { ArchiveEntry, ArchiveCreateRequest } from '@volt/contracts/modules/cluster/daemon-archive';

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
    entries: ArchiveEntry[];
    outputObjectKey: string;
    outputBucket?: string;
    filename: string;
    cacheControl?: string;
}

class ClusterObjectArchiveService {
    async createArchiveDownload(input: CreateArchiveDownloadInput): Promise<ClusterArchiveDownload> {
        const bucket = input.outputBucket || TEAM_CLUSTER_OBJECT_STORE_BUCKET.Trajectories;

        await teamClusterDaemonClient.command(
            input.teamClusterId,
            DaemonCommand.ObjectStoreArchiveCreate,
            {
                output: {
                    bucket,
                    objectKey: input.outputObjectKey
                },
                entries: input.entries
            } satisfies ArchiveCreateRequest,
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
