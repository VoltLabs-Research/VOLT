import { SYS_BUCKETS } from '@core/config/minio';
import StoragePlacementRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { FileMetadata, IStorageService } from '@shared/domain/port/IStorageService';
import {
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
} from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { isStorageObjectNotFoundError } from '@shared/infrastructure/utilities/storage-errors';
import type { Readable } from 'node:stream';
import { inject } from 'tsyringe';

interface ServerObjectHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

export interface ServerObjectStreamResponse extends ServerObjectHeadResponse {
    stream: Readable;
}

const normalizeObjectMetadata = (stat: FileMetadata): Record<string, string> => {
    return Object.fromEntries(
        Object.entries(stat)
            .filter(([key, value]) => key.startsWith('x-amz-meta-') && typeof value === 'string')
            .map(([key, value]) => [key.slice('x-amz-meta-'.length), value as string])
    );
};

const toHeadResponse = (stat: FileMetadata): ServerObjectHeadResponse => {
    const metadata = normalizeObjectMetadata(stat);
    const contentEncoding = metadata['content-encoding'] || metadata['Content-Encoding'];

    return {
        contentLength: stat.size,
        contentType: stat.mimetype,
        contentEncoding: typeof contentEncoding === 'string' && contentEncoding.length > 0
            ? contentEncoding
            : undefined,
        etag: stat.etag,
        lastModified: stat.lastModified,
        metadata
    };
};

@Singleton()
export default class VoltServerObjectGatewayService {
    constructor(
        
        private readonly storagePlacementRepository: StoragePlacementRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async getObjectHead(teamId: string, bucket: string, objectKey: string): Promise<ServerObjectHeadResponse> {
        await this.assertTeamOwnsObject(teamId, bucket, objectKey);

        try {
            return toHeadResponse(await this.storageService.getStat(bucket, objectKey));
        } catch (error: unknown) {
            if (isStorageObjectNotFoundError(error)) {
                throw ApplicationError.notFound(
                    'TeamCluster::DirectAccessObjectNotFound',
                    'The requested object was not found'
                );
            }

            throw error;
        }
    }

    async getObjectStream(teamId: string, bucket: string, objectKey: string): Promise<ServerObjectStreamResponse> {
        await this.assertTeamOwnsObject(teamId, bucket, objectKey);

        try {
            const [stat, stream] = await Promise.all([
                this.storageService.getStat(bucket, objectKey),
                this.storageService.getStream(bucket, objectKey)
            ]);

            return {
                ...toHeadResponse(stat),
                stream
            };
        } catch (error: unknown) {
            if (isStorageObjectNotFoundError(error)) {
                throw ApplicationError.notFound(
                    'TeamCluster::DirectAccessObjectNotFound',
                    'The requested object was not found'
                );
            }

            throw error;
        }
    }

    applyResponseHeaders(
        headers: ServerObjectHeadResponse,
        setHeader: (name: string, value: string) => void
    ): void {
        if (typeof headers.contentLength === 'number') {
            setHeader('content-length', String(headers.contentLength));
        }

        if (headers.contentType) {
            setHeader('content-type', headers.contentType);
        }

        if (headers.contentEncoding) {
            setHeader('content-encoding', headers.contentEncoding);
        }

        if (headers.etag) {
            setHeader('etag', headers.etag);
        }

        if (headers.lastModified) {
            setHeader('last-modified', headers.lastModified.toUTCString());
        }

        for (const [key, value] of Object.entries(headers.metadata)) {
            setHeader(`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key}`, value);
        }
    }

    private async assertTeamOwnsObject(teamId: string, bucket: string, objectKey: string): Promise<void> {
        if (bucket !== SYS_BUCKETS.PLUGINS) {
            throw ApplicationError.forbidden(
                'TeamCluster::DirectAccessForbidden',
                'The requested bucket is not available through the Volt server object gateway'
            );
        }

        const placements = await this.storagePlacementRepository.listByPrimaryClusterId(
            teamId,
            VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
        );

        const isAuthorized = placements.some((placement) => {
            return placement.props.buckets.some((bucketRef) => {
                return bucketRef.bucket === bucket && objectKey.startsWith(bucketRef.prefix);
            });
        });

        if (isAuthorized) {
            return;
        }

        throw ApplicationError.forbidden(
            'TeamCluster::DirectAccessForbidden',
            'The requested server-owned object is not published for this team'
        );
    }
}
