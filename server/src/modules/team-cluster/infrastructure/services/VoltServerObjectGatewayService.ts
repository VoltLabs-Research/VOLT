import { SYS_BUCKETS } from '@core/config/minio';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import {
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
    type TeamClusterDirectAccessGrantResponse
} from '@shared/infrastructure/contracts/team-cluster';
import {
    readRelayHostValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { IStorageService, FileMetadata } from '@shared/domain/port/IStorageService';
import type { Readable } from 'node:stream';
import type { TeamClusterDirectAccessTokenClaims } from './TeamClusterDirectAccessTokenService';
import TeamClusterDirectAccessTokenService from './TeamClusterDirectAccessTokenService';

const DEFAULT_SERVER_PORT = 8000;
const DIRECT_ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
const OBJECT_GATEWAY_EXPOSURE_ID = 'volt-server:object-gateway';
const OBJECT_GATEWAY_EXPOSURE_NAME = 'object-gateway';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

interface GrantRequester {
    kind: 'daemon' | 'server';
    id: string;
}

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

interface StorageObjectErrorLike {
    code?: string;
    statusCode?: number;
}

const isStorageObjectNotFoundError = (error: unknown): error is StorageObjectErrorLike => {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const candidate = error as StorageObjectErrorLike;
    return candidate.code === 'NotFound'
        || candidate.code === 'NoSuchKey'
        || candidate.statusCode === 404;
};

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

const readConfiguredGatewayEndpoint = (): string | null => {
    const endpoint = process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENDPOINT?.trim()
        || process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT?.trim()
        || process.env.SERVER_ENDPOINT?.trim()
        || process.env.VOLT_CLOUD_URL?.trim();

    return endpoint || null;
};

const resolveGatewayEndpoint = (): TeamClusterDirectAccessGrantResponse['endpoint'] => {
    const configuredEndpoint = readConfiguredGatewayEndpoint();
    if (configuredEndpoint) {
        try {
            const endpoint = new URL(configuredEndpoint);
            return {
                protocol: endpoint.protocol === 'https:'
                    ? 'https'
                    : 'http',
                host: endpoint.hostname,
                port: endpoint.port
                    ? Number(endpoint.port)
                    : endpoint.protocol === 'https:'
                        ? 443
                        : 80
            };
        } catch {
        }
    }

    const bindHost = readRelayHostValue('SERVER_HOST', '0.0.0.0');
    const advertisedHost = resolveRelayAdvertisedHost(bindHost, 'TEAM_CLUSTER_OBJECT_GATEWAY_ADVERTISED_HOST');

    if (LOOPBACK_HOSTS.has(advertisedHost)) {
        throw ApplicationError.internalServerError(
            'Volt server object gateway requires TEAM_CLUSTER_OBJECT_GATEWAY_ENDPOINT, TEAM_CLUSTER_BINARY_RELAY_ENDPOINT, or TEAM_CLUSTER_OBJECT_GATEWAY_ADVERTISED_HOST to advertise a host reachable by cluster daemons.'
        );
    }

    return {
        protocol: process.env.SERVER_SCHEMA?.trim() === 'https'
            ? 'https'
            : 'http',
        host: advertisedHost,
        port: readNumberEnv('SERVER_PORT', DEFAULT_SERVER_PORT)
    };
};

const resolveSecretKey = (): string => {
    const secretKey = process.env.SECRET_KEY?.trim();
    if (!secretKey) {
        throw ApplicationError.internalServerError('SECRET_KEY is required to issue Volt server direct access tokens');
    }

    return secretKey;
};

@injectable()
export default class VoltServerObjectGatewayService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementRepository)
        private readonly storagePlacementRepository: StoragePlacementRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(TeamClusterDirectAccessTokenService)
        private readonly tokenService: TeamClusterDirectAccessTokenService
    ) {}

    issueGrant(
        requester: GrantRequester,
        teamId: string
    ): TeamClusterDirectAccessGrantResponse {
        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + DIRECT_ACCESS_TOKEN_TTL_SECONDS;

        return {
            ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            exposureName: OBJECT_GATEWAY_EXPOSURE_NAME,
            exposureId: OBJECT_GATEWAY_EXPOSURE_ID,
            accessMode: TeamClusterServiceExposureAccessMode.Http,
            endpoint: resolveGatewayEndpoint(),
            token: this.tokenService.create(resolveSecretKey(), {
                requesterKind: requester.kind,
                requesterId: requester.id,
                ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
                teamId,
                exposureId: OBJECT_GATEWAY_EXPOSURE_ID,
                exposureName: OBJECT_GATEWAY_EXPOSURE_NAME,
                accessMode: TeamClusterServiceExposureAccessMode.Http,
                iat: issuedAt,
                exp: expiresAt
            }),
            expiresAt: new Date(expiresAt * 1000).toISOString()
        };
    }

    verifyToken(token: string): TeamClusterDirectAccessTokenClaims | null {
        const claims = this.tokenService.verify(resolveSecretKey(), token);
        if (!claims) {
            return null;
        }

        if (
            claims.ownerClusterId !== VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
            || claims.exposureId !== OBJECT_GATEWAY_EXPOSURE_ID
            || claims.exposureName !== OBJECT_GATEWAY_EXPOSURE_NAME
            || claims.accessMode !== TeamClusterServiceExposureAccessMode.Http
        ) {
            return null;
        }

        return claims;
    }

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
