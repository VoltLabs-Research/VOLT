import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import TeamClusterObjectStoreProxyService from '@modules/cluster/services/TeamClusterObjectStoreProxyService';
import {
    applyObjectHeaders,
    applyRangeHeaders,
    isPartialContent,
    readContentLength,
    sendObjectError
} from '@modules/cluster/controllers/cluster-object-http';
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

const PROXY_FAILURE = {
    code: 'TeamCluster::ObjectStoreProxyFailed',
    message: 'Unexpected object store proxy error'
};

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
            ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_INVALID_PATH,
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
            ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_ROUTE_NOT_FOUND,
            'Object store proxy route not found'
        );
    }

    const ownerPath = pathname.slice(ownersPath.length);
    const ownerSlashIndex = ownerPath.indexOf('/');
    if (ownerSlashIndex < 0) {
        throw ApplicationError.notFound(
            ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_ROUTE_NOT_FOUND,
            'Object store proxy route not found'
        );
    }

    const ownerClusterId = decodePathComponent(ownerPath.slice(0, ownerSlashIndex), 'ownerClusterId');
    const bucketPath = ownerPath.slice(ownerSlashIndex);
    const bucketsPrefix = '/buckets/';
    if (!bucketPath.startsWith(bucketsPrefix)) {
        throw ApplicationError.notFound(
            ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_ROUTE_NOT_FOUND,
            'Object store proxy route not found'
        );
    }

    const bucketSection = bucketPath.slice(bucketsPrefix.length);
    const bucketSlashIndex = bucketSection.indexOf('/');
    if (bucketSlashIndex < 0) {
        throw ApplicationError.notFound(
            ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_ROUTE_NOT_FOUND,
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
            ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_ROUTE_NOT_FOUND,
            'Object store proxy route not found'
        );
    }

    const encodedObjectKey = remainder.slice('/objects/'.length);
    if (!encodedObjectKey) {
        throw ApplicationError.badRequest(
            ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_OBJECT_KEY_REQUIRED,
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

const readMetadataHeaders = (request: Request): Record<string, string> => {
    const metadata: Record<string, string> = {};

    for (const [headerName, headerValue] of Object.entries(request.headers)) {
        if (!headerName.startsWith(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX)) {
            continue;
        }

        const metadataKey = headerName.slice(TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX.length);
        if (Array.isArray(headerValue)) {
            metadata[metadataKey] = headerValue.join(', ');
        } else if (headerValue !== undefined) {
            metadata[metadataKey] = headerValue;
        }
    }

    return metadata;
};

const applyMetadataHeaders = (response: Response, metadata: Record<string, string>): void => {
    for (const [key, value] of Object.entries(metadata)) {
        response.setHeader(`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key}`, value);
    }
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
                        ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_METHOD_NOT_ALLOWED,
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
                    applyObjectHeaders(response, head);
                    applyMetadataHeaders(response, head.metadata);
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
                    applyObjectHeaders(response, streamResponse);
                    applyMetadataHeaders(response, streamResponse.metadata);
                    applyRangeHeaders(response, streamResponse.headers);
                    response.status(isPartialContent(streamResponse.headers) ? 206 : 200);
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
                    ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_METHOD_NOT_ALLOWED,
                    'Method not allowed',
                    405
                );
            } catch (error: unknown) {
                if (!response.headersSent) {
                    sendObjectError(response, error, PROXY_FAILURE);
                    return;
                }

                response.destroy(error instanceof Error ? error : undefined);
            }
        });

        return router;
    }
}
