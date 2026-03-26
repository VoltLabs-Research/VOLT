import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterObjectGatewayClient, {
    TeamClusterObjectGatewayHeadResponse
} from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import VoltServerObjectGatewayService from '@modules/team-cluster/infrastructure/services/VoltServerObjectGatewayService';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@shared/infrastructure/contracts/team-cluster';
import {
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@shared/infrastructure/contracts/team-cluster';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import { container } from 'tsyringe';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

const objectGatewayClient = (): TeamClusterObjectGatewayClient => {
    return container.resolve(TeamClusterObjectGatewayClient);
};

const voltServerObjectGatewayService = (): VoltServerObjectGatewayService => {
    return container.resolve(VoltServerObjectGatewayService);
};

const daemonCredentialGuard = (): DaemonCredentialGuard => {
    return container.resolve(DaemonCredentialGuard);
};

const teamClusterRepository = (): ITeamClusterRepository => {
    return container.resolve(TEAM_CLUSTER_TOKENS.TeamClusterRepository);
};

const readHeader = (request: Request, headerName: string): string | undefined => {
    const value = request.header(headerName);
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
};

const readBooleanHeader = (request: Request, headerName: string): boolean => {
    const value = readHeader(request, headerName);
    return value === '1' || value === 'true';
};

const decodePathComponent = (value: string, fieldName: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        throw ApplicationError.badRequest(
            'TeamCluster::ObjectStoreProxyInvalidPath',
            `${fieldName} contains invalid path encoding`
        );
    }
};

const resolveRoute = (
    pathname: string
): { ownerClusterId: string; bucket: string; type: 'collection'; }
    | { ownerClusterId: string; bucket: string; type: 'object'; objectKey: string; } => {
    const ownersPath = '/owners/';
    if (!pathname.startsWith(ownersPath)) {
        throw ApplicationError.notFound(
            'TeamCluster::ObjectStoreProxyRouteNotFound',
            'Object store proxy route not found'
        );
    }

    const ownerPath = pathname.slice(ownersPath.length);
    const ownerSlashIndex = ownerPath.indexOf('/');
    if (ownerSlashIndex < 0) {
        throw ApplicationError.notFound(
            'TeamCluster::ObjectStoreProxyRouteNotFound',
            'Object store proxy route not found'
        );
    }

    const ownerClusterId = decodePathComponent(ownerPath.slice(0, ownerSlashIndex), 'ownerClusterId');
    const bucketPath = ownerPath.slice(ownerSlashIndex);
    const bucketsPrefix = '/buckets/';
    if (!bucketPath.startsWith(bucketsPrefix)) {
        throw ApplicationError.notFound(
            'TeamCluster::ObjectStoreProxyRouteNotFound',
            'Object store proxy route not found'
        );
    }

    const bucketSection = bucketPath.slice(bucketsPrefix.length);
    const bucketSlashIndex = bucketSection.indexOf('/');
    if (bucketSlashIndex < 0) {
        throw ApplicationError.notFound(
            'TeamCluster::ObjectStoreProxyRouteNotFound',
            'Object store proxy route not found'
        );
    }

    const bucket = decodePathComponent(bucketSection.slice(0, bucketSlashIndex), 'bucket');
    const remainder = bucketSection.slice(bucketSlashIndex);

    if (remainder === '/objects' || remainder === '/objects/') {
        return {
            ownerClusterId,
            bucket,
            type: 'collection'
        };
    }

    if (!remainder.startsWith('/objects/')) {
        throw ApplicationError.notFound(
            'TeamCluster::ObjectStoreProxyRouteNotFound',
            'Object store proxy route not found'
        );
    }

    const encodedObjectKey = remainder.slice('/objects/'.length);
    if (!encodedObjectKey) {
        throw ApplicationError.badRequest(
            'TeamCluster::ObjectStoreProxyObjectKeyRequired',
            'objectKey is required'
        );
    }

    return {
        ownerClusterId,
        bucket,
        type: 'object',
        objectKey: decodePathComponent(encodedObjectKey, 'objectKey')
    };
};

const readContentLength = (request: Request): number => {
    const rawContentLength = request.header('content-length');
    if (!rawContentLength) {
        throw ApplicationError.badRequest(
            'TeamCluster::ObjectStoreProxyContentLengthRequired',
            'content-length header is required for uploads'
        );
    }

    const contentLength = Number(rawContentLength);
    if (!Number.isInteger(contentLength) || contentLength < 0) {
        throw ApplicationError.badRequest(
            'TeamCluster::ObjectStoreProxyInvalidContentLength',
            'content-length must be a non-negative integer'
        );
    }

    return contentLength;
};

const readMetadataHeaders = (request: Request): Record<string, string> => {
    const metadata: Record<string, string> = {};

    for (const [headerName, headerValue] of Object.entries(request.headers)) {
        if (!headerName.startsWith(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX)) {
            continue;
        }

        if (Array.isArray(headerValue)) {
            metadata[headerName.slice(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX.length)] = headerValue.join(', ');
            continue;
        }

        if (typeof headerValue === 'string') {
            metadata[headerName.slice(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX.length)] = headerValue;
        }
    }

    return metadata;
};

const applyResponseHeaders = (
    headers: TeamClusterObjectGatewayHeadResponse,
    response: Response
): void => {
    if (typeof headers.contentLength === 'number') {
        response.setHeader('content-length', String(headers.contentLength));
    }

    if (headers.contentType) {
        response.setHeader('content-type', headers.contentType);
    }

    if (headers.contentEncoding) {
        response.setHeader('content-encoding', headers.contentEncoding);
    }

    if (headers.etag) {
        response.setHeader('etag', headers.etag);
    }

    if (headers.lastModified) {
        response.setHeader('last-modified', headers.lastModified.toUTCString());
    }

    for (const [key, value] of Object.entries(headers.metadata)) {
        response.setHeader(`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key}`, value);
    }
};

const sendError = (response: Response, error: unknown): void => {
    const message = error instanceof Error ? error.message : 'Unexpected object store proxy error';
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'TeamCluster::ObjectStoreProxyFailed';
    const statusCode = typeof error === 'object'
        && error !== null
        && 'statusCode' in error
        && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    response.status(statusCode).json({
        status: 'error',
        code,
        message
    });
};

const assertOwnerAccess = async (
    requesterClusterId: string,
    ownerClusterId: string,
    daemonPassword: string
): Promise<{ teamId: string; }> => {
    const requesterCluster = await daemonCredentialGuard().requireByDaemonPassword(
        requesterClusterId,
        daemonPassword
    );

    if (ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
        return { teamId: requesterCluster.props.team };
    }

    const ownerCluster = await teamClusterRepository().findById(ownerClusterId);
    if (!ownerCluster) {
        throw ApplicationError.notFound(
            'TeamCluster::ObjectStoreProxyOwnerNotFound',
            'The requested owner cluster does not exist'
        );
    }

    if (ownerCluster.props.team !== requesterCluster.props.team) {
        throw ApplicationError.forbidden(
            'TeamCluster::ObjectStoreProxyForbidden',
            'The requested owner cluster does not belong to the same team'
        );
    }

    return { teamId: requesterCluster.props.team };
};

export default createHttpModule({
    basePath: TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH,
    routes: (router) => {
        router.use(async (request, response) => {
            try {
                const requesterClusterId = readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER);
                const daemonPassword = readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER);
                if (!requesterClusterId || !daemonPassword) {
                    throw ApplicationError.unauthorized(
                        'TeamCluster::ObjectStoreProxyUnauthorized',
                        'Daemon authentication headers are required'
                    );
                }

                const resolvedRoute = resolveRoute(request.path);
                const { teamId } = await assertOwnerAccess(
                    requesterClusterId,
                    resolvedRoute.ownerClusterId,
                    daemonPassword
                );

                if (resolvedRoute.ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
                    if (request.method !== 'HEAD' && request.method !== 'GET') {
                        response.setHeader('allow', 'GET, HEAD');
                        throw new ApplicationError(
                            'TeamCluster::ObjectStoreProxyMethodNotAllowed',
                            'Method not allowed for Volt server-owned objects',
                            405
                        );
                    }

                    if (resolvedRoute.type !== 'object') {
                        throw ApplicationError.badRequest(
                            'TeamCluster::ObjectStoreProxyUnsupportedServerCollection',
                            'Volt server-owned collection operations are not supported'
                        );
                    }

                    if (request.method === 'HEAD') {
                        const head = await voltServerObjectGatewayService().getObjectHead(
                            teamId,
                            resolvedRoute.bucket,
                            resolvedRoute.objectKey
                        );
                        voltServerObjectGatewayService().applyResponseHeaders(head, (name, value) => {
                            response.setHeader(name, value);
                        });
                        response.status(200).end();
                        return;
                    }

                    const streamResponse = await voltServerObjectGatewayService().getObjectStream(
                        teamId,
                        resolvedRoute.bucket,
                        resolvedRoute.objectKey
                    );
                    voltServerObjectGatewayService().applyResponseHeaders(streamResponse, (name, value) => {
                        response.setHeader(name, value);
                    });
                    response.status(200);
                    await pipeline(streamResponse.stream, response);
                    return;
                }

                if (resolvedRoute.type === 'collection') {
                    if (request.method === 'GET') {
                        const listResponse = await objectGatewayClient().list(resolvedRoute.ownerClusterId, {
                            bucket: resolvedRoute.bucket,
                            prefix: request.query.prefix as string | undefined,
                            cursor: request.query.cursor as string | undefined,
                            limit: typeof request.query.limit === 'string'
                                ? Number(request.query.limit)
                                : undefined
                        });
                        response.json(listResponse);
                        return;
                    }

                    if (request.method === 'DELETE') {
                        const prefix = typeof request.query.prefix === 'string'
                            ? request.query.prefix
                            : '';
                        const deletedCount = await objectGatewayClient().deleteByPrefix(
                            resolvedRoute.ownerClusterId,
                            resolvedRoute.bucket,
                            prefix
                        );
                        response.json({ deletedCount });
                        return;
                    }

                    response.setHeader('allow', 'GET, DELETE');
                    throw new ApplicationError(
                        'TeamCluster::ObjectStoreProxyMethodNotAllowed',
                        'Method not allowed',
                        405
                    );
                }

                if (request.method === 'HEAD') {
                    const head = await objectGatewayClient().head(
                        resolvedRoute.ownerClusterId,
                        resolvedRoute.bucket,
                        resolvedRoute.objectKey
                    );
                    applyResponseHeaders(head, response);
                    response.status(200).end();
                    return;
                }

                if (request.method === 'GET') {
                    const skipMetadata = readBooleanHeader(request, TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER);
                    const streamResponse = await objectGatewayClient().getStream(
                        resolvedRoute.ownerClusterId,
                        resolvedRoute.bucket,
                        resolvedRoute.objectKey,
                        skipMetadata ? { skipMetadata: true } : undefined
                    );
                    applyResponseHeaders(streamResponse, response);
                    response.status(200);
                    await pipeline(streamResponse.stream, response);
                    return;
                }

                if (request.method === 'PUT') {
                    const contentType = request.header('content-type') || undefined;
                    const contentEncoding = request.header('content-encoding') || undefined;
                    await objectGatewayClient().putStream(resolvedRoute.ownerClusterId, {
                        bucket: resolvedRoute.bucket,
                        objectKey: resolvedRoute.objectKey,
                        stream: request,
                        contentLength: readContentLength(request),
                        ...(contentType ? { contentType } : {}),
                        ...(contentEncoding ? { contentEncoding } : {}),
                        metadata: readMetadataHeaders(request)
                    });
                    response.status(201).end();
                    return;
                }

                if (request.method === 'DELETE') {
                    await objectGatewayClient().deleteObject(
                        resolvedRoute.ownerClusterId,
                        resolvedRoute.bucket,
                        resolvedRoute.objectKey
                    );
                    response.status(204).end();
                    return;
                }

                response.setHeader('allow', 'GET, HEAD, PUT, DELETE');
                throw new ApplicationError(
                    'TeamCluster::ObjectStoreProxyMethodNotAllowed',
                    'Method not allowed',
                    405
                );
            } catch (error) {
                if (!response.headersSent) {
                    sendError(response, error);
                    return;
                }

                response.destroy(error instanceof Error ? error : undefined);
            }
        });
    }
});
