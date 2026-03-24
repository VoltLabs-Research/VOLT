import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import {
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
} from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import type TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type TeamClusterObjectGatewayClient from './TeamClusterObjectGatewayClient';
import type { Readable } from 'node:stream';

interface ListRequest {
    bucket: string;
    prefix?: string;
    cursor?: string;
    limit?: number;
}

interface ObjectHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

interface ObjectStreamResponse extends ObjectHeadResponse {
    stream: Readable;
}

interface PutObjectStreamRequest {
    bucket: string;
    objectKey: string;
    stream: Readable;
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

export interface AuthorizedClusterObjectStoreAccess {
    requesterCluster: TeamCluster;
    ownerClusterId: string;
    ownerCluster: TeamCluster | null;
    usesServerLocalStorage: boolean;
}

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1_000;
const MINIO_METADATA_PREFIX = 'x-amz-meta-';

const isFinitePositiveInteger = (value: number | undefined): value is number => {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

const clampListLimit = (value?: number): number => {
    if (!isFinitePositiveInteger(value)) {
        return DEFAULT_LIST_LIMIT;
    }

    return Math.min(value, MAX_LIST_LIMIT);
};

const normalizeRemoteMetadata = (metadata?: Record<string, unknown>): Record<string, string> => {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (typeof value !== 'string') {
            continue;
        }

        if (!key.startsWith(MINIO_METADATA_PREFIX)) {
            continue;
        }

        normalized[key.slice(MINIO_METADATA_PREFIX.length).toLowerCase()] = value;
    }

    return normalized;
};

const normalizeStorageUploadMetadata = (
    metadata?: Record<string, string>,
    contentType?: string,
    contentEncoding?: string
): Record<string, string> => {
    const normalized: Record<string, string> = {};

    if (contentType) {
        normalized['Content-Type'] = contentType;
    }

    if (contentEncoding) {
        normalized['Content-Encoding'] = contentEncoding;
    }

    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (!value) {
            continue;
        }

        normalized[`${MINIO_METADATA_PREFIX}${key.toLowerCase()}`] = value;
    }

    return normalized;
};

@injectable()
export default class InternalClusterObjectStoreProxyService {
    constructor(
        @inject(SHARED_TOKENS.DaemonCredentialGuard)
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async authorize(
        requesterClusterId: string,
        daemonPassword: string,
        ownerClusterId: string
    ): Promise<AuthorizedClusterObjectStoreAccess> {
        const requesterCluster = await this.daemonCredentialGuard.requireByDaemonPassword(
            requesterClusterId,
            daemonPassword
        );

        if (ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            return {
                requesterCluster,
                ownerClusterId,
                ownerCluster: null,
                usesServerLocalStorage: true
            };
        }

        const ownerCluster = await this.teamClusterRepository.findById(ownerClusterId);
        if (!ownerCluster) {
            throw ApplicationError.notFound(
                'TeamCluster::ObjectOwnerNotFound',
                'Object owner cluster not found'
            );
        }

        if (ownerCluster.props.team !== requesterCluster.props.team) {
            throw ApplicationError.forbidden(
                'TeamCluster::ObjectOwnerForbidden',
                'Object owner cluster does not belong to the same team'
            );
        }

        return {
            requesterCluster,
            ownerClusterId,
            ownerCluster,
            usesServerLocalStorage: false
        };
    }

    async list(
        access: AuthorizedClusterObjectStoreAccess,
        request: ListRequest
    ): Promise<{ keys: string[]; nextCursor?: string; }> {
        if (!access.usesServerLocalStorage) {
            return this.objectGatewayClient.list(access.ownerClusterId, {
                bucket: request.bucket,
                prefix: request.prefix,
                cursor: request.cursor,
                limit: clampListLimit(request.limit)
            });
        }

        const limit = clampListLimit(request.limit);
        const keys: string[] = [];
        let nextCursor: string | undefined;
        let consume = request.cursor ? false : true;

        for await (const key of this.storageService.listByPrefix(request.bucket, request.prefix ?? '')) {
            if (!consume) {
                if (key <= request.cursor!) {
                    continue;
                }

                consume = true;
            }

            keys.push(key);
            if (keys.length > limit) {
                nextCursor = keys[limit - 1];
                keys.length = limit;
                break;
            }
        }

        return {
            keys,
            nextCursor
        };
    }

    async head(
        access: AuthorizedClusterObjectStoreAccess,
        bucket: string,
        objectKey: string
    ): Promise<ObjectHeadResponse> {
        if (!access.usesServerLocalStorage) {
            const response = await this.objectGatewayClient.head(access.ownerClusterId, bucket, objectKey);
            return {
                contentLength: response.contentLength,
                contentType: response.contentType,
                contentEncoding: response.contentEncoding,
                etag: response.etag,
                lastModified: response.lastModified,
                metadata: response.metadata
            };
        }

        const stat = await this.storageService.getStat(bucket, objectKey);
        return {
            contentLength: stat.size,
            contentType: stat.mimetype,
            etag: stat.etag,
            lastModified: stat.lastModified,
            metadata: normalizeRemoteMetadata(stat as Record<string, unknown>)
        };
    }

    async getStream(
        access: AuthorizedClusterObjectStoreAccess,
        bucket: string,
        objectKey: string
    ): Promise<ObjectStreamResponse> {
        if (!access.usesServerLocalStorage) {
            const response = await this.objectGatewayClient.getStream(access.ownerClusterId, bucket, objectKey);
            return {
                contentLength: response.contentLength,
                contentType: response.contentType,
                contentEncoding: response.contentEncoding,
                etag: response.etag,
                lastModified: response.lastModified,
                metadata: response.metadata,
                stream: response.stream
            };
        }

        const [stat, stream] = await Promise.all([
            this.storageService.getStat(bucket, objectKey),
            this.storageService.getStream(bucket, objectKey)
        ]);

        return {
            contentLength: stat.size,
            contentType: stat.mimetype,
            etag: stat.etag,
            lastModified: stat.lastModified,
            metadata: normalizeRemoteMetadata(stat as Record<string, unknown>),
            stream
        };
    }

    async putStream(
        access: AuthorizedClusterObjectStoreAccess,
        request: PutObjectStreamRequest
    ): Promise<void> {
        if (!access.usesServerLocalStorage) {
            await this.objectGatewayClient.putStream(access.ownerClusterId, {
                bucket: request.bucket,
                objectKey: request.objectKey,
                stream: request.stream,
                contentLength: request.contentLength ?? 0,
                contentType: request.contentType,
                contentEncoding: request.contentEncoding,
                metadata: request.metadata
            });

            logger.info(
                {
                    action: 'artifact.write.remote',
                    ownerClusterId: access.ownerClusterId,
                    bucket: request.bucket,
                    objectKey: request.objectKey
                },
                'Proxy stored object in remote owner cluster'
            );
            return;
        }

        await this.storageService.upload(
            request.bucket,
            request.objectKey,
            request.stream,
            normalizeStorageUploadMetadata(request.metadata, request.contentType, request.contentEncoding)
        );
    }

    async deleteObject(
        access: AuthorizedClusterObjectStoreAccess,
        bucket: string,
        objectKey: string
    ): Promise<void> {
        if (!access.usesServerLocalStorage) {
            await this.objectGatewayClient.deleteObject(access.ownerClusterId, bucket, objectKey);
            return;
        }

        await this.storageService.delete(bucket, objectKey);
    }

    async deleteByPrefix(
        access: AuthorizedClusterObjectStoreAccess,
        bucket: string,
        prefix: string
    ): Promise<number | undefined> {
        if (!access.usesServerLocalStorage) {
            return this.objectGatewayClient.deleteByPrefix(access.ownerClusterId, bucket, prefix);
        }

        let deletedCount = 0;
        for await (const _key of this.storageService.listByPrefix(bucket, prefix)) {
            deletedCount += 1;
        }

        await this.storageService.deleteByPrefix(bucket, prefix);
        return deletedCount;
    }

    toMetadataHeaders(metadata: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = {};

        for (const [key, value] of Object.entries(metadata)) {
            if (!value) {
                continue;
            }

            headers[`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key.toLowerCase()}`] = value;
        }

        return headers;
    }
}
