import InternalClusterObjectStoreProxyService, {
    type AuthorizedClusterObjectStoreAccess
} from '@modules/team-cluster/infrastructure/services/InternalClusterObjectStoreProxyService';
import {
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH
} from '@shared/infrastructure/contracts/team-cluster';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';
import { pipeline } from 'node:stream/promises';
import type { NextFunction, Request, Response } from 'express';

interface AuthenticatedObjectStoreRequest extends Request {
    clusterObjectStoreAccess?: AuthorizedClusterObjectStoreAccess;
}

const service = (): InternalClusterObjectStoreProxyService => {
    return container.resolve(InternalClusterObjectStoreProxyService);
};

const readHeader = (request: Request, headerName: string): string | undefined => {
    const value = request.header(headerName);
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
};

const readSingleParam = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) {
        return value[0];
    }

    return value;
};

const decodePathComponent = (value: string | string[] | undefined, fieldName: string): string => {
    const resolvedValue = readSingleParam(value);
    if (!resolvedValue) {
        throw new Error(`${fieldName} is required`);
    }

    try {
        return decodeURIComponent(resolvedValue);
    } catch {
        throw new Error(`${fieldName} contains invalid path encoding`);
    }
};

const decodeObjectKey = (request: Request): string => {
    const wildcardValue = request.params.objectKey;
    const segments = Array.isArray(wildcardValue)
        ? wildcardValue
        : typeof wildcardValue === 'string' && wildcardValue.length > 0
            ? [wildcardValue]
            : [];

    if (!segments.length) {
        throw new Error('objectKey is required');
    }

    return segments
        .map((segment) => decodePathComponent(segment, 'objectKey'))
        .join('/');
};

const readLimit = (request: Request): number | undefined => {
    const rawValue = request.query.limit;
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        return undefined;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error('limit must be a positive integer');
    }

    return parsedValue;
};

const readOptionalStringQuery = (request: Request, fieldName: 'prefix' | 'cursor'): string | undefined => {
    const rawValue = request.query[fieldName];
    if (typeof rawValue !== 'string' || rawValue.length === 0) {
        return undefined;
    }

    return rawValue;
};

const readMetadataHeaders = (request: Request): Record<string, string> => {
    const metadata: Record<string, string> = {};

    for (const [headerName, headerValue] of Object.entries(request.headers)) {
        if (!headerName.startsWith('x-object-meta-')) {
            continue;
        }

        if (typeof headerValue === 'string' && headerValue.length > 0) {
            metadata[headerName.slice('x-object-meta-'.length)] = headerValue;
        }
    }

    return metadata;
};

const applyHeadHeaders = (
    response: Response,
    objectStoreService: InternalClusterObjectStoreProxyService,
    headResponse: Awaited<ReturnType<InternalClusterObjectStoreProxyService['head']>>
): void => {
    if (typeof headResponse.contentLength === 'number') {
        response.setHeader('content-length', String(headResponse.contentLength));
    }

    if (headResponse.contentType) {
        response.setHeader('content-type', headResponse.contentType);
    }

    // Do not forward content-encoding on the internal proxy surface.
    // Daemon fetch() auto-decompresses gzip responses, but the object-store
    // contract expects raw object bytes so downstream services can decide
    // whether to gunzip based on the logical object format.

    if (headResponse.etag) {
        response.setHeader('etag', headResponse.etag);
    }

    if (headResponse.lastModified) {
        response.setHeader('last-modified', headResponse.lastModified.toUTCString());
    }

    for (const [headerName, headerValue] of Object.entries(objectStoreService.toMetadataHeaders(headResponse.metadata))) {
        response.setHeader(headerName, headerValue);
    }
}

const sendError = (response: Response, error: unknown): void => {
    const message = error instanceof Error ? error.message : 'Unexpected internal object store error';
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'TeamCluster::InternalObjectStoreProxyError';
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

const authenticate = async (
    request: AuthenticatedObjectStoreRequest,
    _response: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const requesterClusterId = readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER);
        const daemonPassword = readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER);
        if (!requesterClusterId || !daemonPassword) {
            throw new Error('Daemon authentication headers are required');
        }

        request.clusterObjectStoreAccess = await service().authorize(
            requesterClusterId,
            daemonPassword,
            decodePathComponent(request.params.ownerClusterId, 'ownerClusterId')
        );
        next();
    } catch (error) {
        next(error);
    }
};

export default createHttpModule({
    basePath: TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH,
    routes: (router) => {
        router.use('/owners/:ownerClusterId', authenticate);

        router.get('/owners/:ownerClusterId/buckets/:bucket/objects', async (request: AuthenticatedObjectStoreRequest, response) => {
            try {
                const access = request.clusterObjectStoreAccess;
                if (!access) {
                    throw new Error('Object store access context is missing');
                }

                const bucket = decodePathComponent(request.params.bucket, 'bucket');
                const page = await service().list(access, {
                    bucket,
                    prefix: readOptionalStringQuery(request, 'prefix'),
                    cursor: readOptionalStringQuery(request, 'cursor'),
                    limit: readLimit(request)
                });

                response.json(page);
            } catch (error) {
                sendError(response, error);
            }
        });

        router.delete('/owners/:ownerClusterId/buckets/:bucket/objects', async (request: AuthenticatedObjectStoreRequest, response) => {
            try {
                const access = request.clusterObjectStoreAccess;
                if (!access) {
                    throw new Error('Object store access context is missing');
                }

                const prefix = readOptionalStringQuery(request, 'prefix');
                if (!prefix) {
                    throw new Error('prefix is required');
                }

                const deletedCount = await service().deleteByPrefix(
                    access,
                    decodePathComponent(request.params.bucket, 'bucket'),
                    prefix
                );

                response.json({ deletedCount });
            } catch (error) {
                sendError(response, error);
            }
        });

        router.head('/owners/:ownerClusterId/buckets/:bucket/objects/*objectKey', async (request: AuthenticatedObjectStoreRequest, response) => {
            try {
                const access = request.clusterObjectStoreAccess;
                if (!access) {
                    throw new Error('Object store access context is missing');
                }

                const objectStoreService = service();
                const headResponse = await objectStoreService.head(
                    access,
                    decodePathComponent(request.params.bucket, 'bucket'),
                    decodeObjectKey(request)
                );

                applyHeadHeaders(response, objectStoreService, headResponse);
                response.status(200).end();
            } catch (error) {
                sendError(response, error);
            }
        });

        router.get('/owners/:ownerClusterId/buckets/:bucket/objects/*objectKey', async (request: AuthenticatedObjectStoreRequest, response) => {
            try {
                const access = request.clusterObjectStoreAccess;
                if (!access) {
                    throw new Error('Object store access context is missing');
                }

                const objectStoreService = service();
                const streamResponse = await objectStoreService.getStream(
                    access,
                    decodePathComponent(request.params.bucket, 'bucket'),
                    decodeObjectKey(request)
                );

                applyHeadHeaders(response, objectStoreService, streamResponse);
                response.status(200);
                await pipeline(streamResponse.stream, response);
            } catch (error) {
                if (!response.headersSent) {
                    sendError(response, error);
                } else {
                    response.destroy(error instanceof Error ? error : undefined);
                }
            }
        });

        router.put('/owners/:ownerClusterId/buckets/:bucket/objects/*objectKey', async (request: AuthenticatedObjectStoreRequest, response) => {
            try {
                const access = request.clusterObjectStoreAccess;
                if (!access) {
                    throw new Error('Object store access context is missing');
                }

                const contentLength = request.header('content-length');
                const parsedContentLength = typeof contentLength === 'string'
                    ? Number(contentLength)
                    : undefined;

                await service().putStream(access, {
                    bucket: decodePathComponent(request.params.bucket, 'bucket'),
                    objectKey: decodeObjectKey(request),
                    stream: request,
                    contentLength: Number.isFinite(parsedContentLength) ? parsedContentLength : undefined,
                    contentType: request.header('content-type') ?? undefined,
                    contentEncoding: request.header('content-encoding') ?? undefined,
                    metadata: readMetadataHeaders(request)
                });

                response.status(204).end();
            } catch (error) {
                sendError(response, error);
            }
        });

        router.delete('/owners/:ownerClusterId/buckets/:bucket/objects/*objectKey', async (request: AuthenticatedObjectStoreRequest, response) => {
            try {
                const access = request.clusterObjectStoreAccess;
                if (!access) {
                    throw new Error('Object store access context is missing');
                }

                await service().deleteObject(
                    access,
                    decodePathComponent(request.params.bucket, 'bucket'),
                    decodeObjectKey(request)
                );

                response.status(204).end();
            } catch (error) {
                sendError(response, error);
            }
        });
    }
});
