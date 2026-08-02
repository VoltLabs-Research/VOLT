import ApplicationError from '@shared/application/errors/ApplicationError';
import TeamClusterObjectStoreProxyService, {
    type TeamClusterObjectStoreHeadResponse
} from '@modules/cluster/services/TeamClusterObjectStoreProxyService';
import {
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@shared/infrastructure/contracts/team-cluster';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';

const readHeader = (request: Request, headerName: string): string | undefined => {
    const value = request.header(headerName)?.trim();
    return value || undefined;
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

const readContentLength = (request: Request): number | undefined => {
    const rawContentLength = request.header('content-length');
    return rawContentLength ? Number(rawContentLength) : undefined;
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
    headers: TeamClusterObjectStoreHeadResponse,
    response: Response
): void => {
    if (headers.contentLength !== undefined) {
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

const applyPassthroughStreamHeaders = (
    streamHeaders: Record<string, string> | undefined,
    response: Response
): void => {
    if (!streamHeaders) {
        return;
    }

    const acceptRanges = streamHeaders['accept-ranges'];
    if (acceptRanges) {
        response.setHeader('accept-ranges', acceptRanges);
    }

    const contentRange = streamHeaders['content-range'];
    if (contentRange) {
        response.setHeader('content-range', contentRange);
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

export default class ClusterObjectStoreProxyController {
    readonly #proxyService = new TeamClusterObjectStoreProxyService();

    buildRouter(): Router {
        const router = Router();

        router.use(TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH, async (request: Request, response: Response) => {
            try {
                const requesterCredentials = this.#proxyService.requireRequesterCredentials(
                    readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER),
                    readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER)
                );
                const resolvedRoute = resolveRoute(request.path);
                const access = await this.#proxyService.authorizeOwner(
                    requesterCredentials,
                    resolvedRoute.ownerClusterId
                );

                if (resolvedRoute.type === 'collection') {
                    if (request.method === 'GET') {
                        const listResponse = await this.#proxyService.list(access, {
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
                        const deletedCount = await this.#proxyService.deletePrefix(
                            access,
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
                    const head = await this.#proxyService.head(
                        access,
                        resolvedRoute.bucket,
                        resolvedRoute.objectKey
                    );
                    applyResponseHeaders(head, response);
                    response.status(200).end();
                    return;
                }

                if (request.method === 'GET') {
                    const skipMetadata = readBooleanHeader(request, TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER);
                    const rangeHeader = readHeader(request, 'range');
                    const readOptions: { skipMetadata?: boolean; rangeHeader?: string } = {};
                    if (skipMetadata) readOptions.skipMetadata = true;
                    if (rangeHeader) readOptions.rangeHeader = rangeHeader;
                    const streamResponse = await this.#proxyService.openRead(
                        access,
                        resolvedRoute.bucket,
                        resolvedRoute.objectKey,
                        Object.keys(readOptions).length > 0 ? readOptions : undefined
                    );
                    applyResponseHeaders(streamResponse, response);
                    applyPassthroughStreamHeaders(streamResponse.headers, response);
                    response.status(streamResponse.headers['content-range'] ? 206 : 200);
                    await pipeline(streamResponse.stream, response);
                    return;
                }

                if (request.method === 'PUT') {
                    const contentType = request.header('content-type') || undefined;
                    const contentEncoding = request.header('content-encoding') || undefined;
                    await this.#proxyService.write(access, {
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
                    await this.#proxyService.delete(
                        access,
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

        return router;
    }
}
