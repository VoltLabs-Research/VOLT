import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import ClusterObjectSignedUrlService from '@modules/cluster-object/infrastructure/services/ClusterObjectSignedUrlService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { pipeline } from 'node:stream/promises';
import { container } from 'tsyringe';

import type { Request, Response } from 'express';
import type { ClusterObjectAccessClaims, ClusterObjectOperation } from '@modules/cluster-object/application/dtos/ClusterObjectGatewayDTO';

const signedUrlService = (): ClusterObjectSignedUrlService => container.resolve(ClusterObjectSignedUrlService);
const objectGatewayClient = (): TeamClusterObjectGatewayClient => container.resolve(TeamClusterObjectGatewayClient);

const readContentLength = (request: Request): number => {
    const rawContentLength = request.header('content-length');
    const contentLength = rawContentLength ? Number(rawContentLength) : Number.NaN;
    if (!Number.isInteger(contentLength) || contentLength < 0) {
        throw ApplicationError.badRequest(
            'ClusterObject::ContentLengthRequired',
            'content-length header is required for object uploads'
        );
    }

    return contentLength;
};

const sendError = (response: Response, error: unknown): void => {
    const statusCode = typeof error === 'object'
        && error !== null
        && 'statusCode' in error
        && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'ClusterObject::GatewayFailed';
    const message = error instanceof Error ? error.message : 'Object gateway request failed';

    response.status(statusCode).json({
        status: 'error',
        code,
        message
    });
};

const resolveClaims = (
    request: Request,
    operation: ClusterObjectOperation
): ClusterObjectAccessClaims => {
    const token = Array.isArray(request.params.token) ? request.params.token[0] : request.params.token;
    const teamId = Array.isArray(request.params.teamId) ? request.params.teamId[0] : request.params.teamId;
    const claims = token ? signedUrlService().verify(token) : null;

    if (!claims || claims.operation !== operation || claims.teamId !== teamId) {
        throw ApplicationError.unauthorized(
            'ClusterObject::InvalidSignedUrl',
            'Object URL is invalid or expired'
        );
    }

    return claims;
};

const applyReadHeaders = (
    response: Response,
    streamResponse: Awaited<ReturnType<TeamClusterObjectGatewayClient['getStream']>>
): void => {
    if (typeof streamResponse.contentLength === 'number') {
        response.setHeader('content-length', String(streamResponse.contentLength));
    }

    if (streamResponse.contentType) {
        response.setHeader('content-type', streamResponse.contentType);
    }

    if (streamResponse.contentEncoding) {
        response.setHeader('content-encoding', streamResponse.contentEncoding);
    }

    if (streamResponse.etag) {
        response.setHeader('etag', streamResponse.etag);
    }

    if (streamResponse.lastModified) {
        response.setHeader('last-modified', streamResponse.lastModified.toUTCString());
    }

    const acceptRanges = streamResponse.headers['accept-ranges'];
    if (acceptRanges) {
        response.setHeader('accept-ranges', acceptRanges);
    }

    const contentRange = streamResponse.headers['content-range'];
    if (contentRange) {
        response.setHeader('content-range', contentRange);
    }

    response.setHeader('cache-control', 'private, max-age=900');
    response.setHeader('x-content-type-options', 'nosniff');
};

export default createHttpModule({
    basePath: '/api/cluster-objects/:teamId',
    protected: false,
    routes: (router) => {
        router.put('/write/:token', async (request, response) => {
            try {
                const claims = resolveClaims(request, 'write');
                const contentLength = readContentLength(request);

                if (typeof claims.contentLength === 'number' && claims.contentLength !== contentLength) {
                    throw ApplicationError.badRequest(
                        'ClusterObject::ContentLengthMismatch',
                        'Uploaded object size does not match the signed URL'
                    );
                }

                await objectGatewayClient().putStream(claims.ownerClusterId, {
                    bucket: claims.bucket,
                    objectKey: claims.objectKey,
                    stream: request,
                    contentLength,
                    contentType: request.header('content-type') || claims.contentType || 'application/octet-stream',
                    contentEncoding: request.header('content-encoding') || undefined,
                    metadata: claims.metadata
                });

                response.status(201).end();
            } catch (error) {
                if (!response.headersSent) {
                    sendError(response, error);
                    return;
                }

                response.destroy(error instanceof Error ? error : undefined);
            }
        });

        router.head('/read/:token', async (request, response) => {
            try {
                const claims = resolveClaims(request, 'read');
                const head = await objectGatewayClient().head(
                    claims.ownerClusterId,
                    claims.bucket,
                    claims.objectKey
                );

                if (typeof head.contentLength === 'number') {
                    response.setHeader('content-length', String(head.contentLength));
                }
                if (head.contentType) response.setHeader('content-type', head.contentType);
                if (head.contentEncoding) response.setHeader('content-encoding', head.contentEncoding);
                if (head.etag) response.setHeader('etag', head.etag);
                if (head.lastModified) response.setHeader('last-modified', head.lastModified.toUTCString());
                response.status(200).end();
            } catch (error) {
                if (!response.headersSent) sendError(response, error);
            }
        });

        router.get('/read/:token', async (request, response) => {
            try {
                const claims = resolveClaims(request, 'read');
                const rangeHeader = request.header('range') || undefined;
                const streamResponse = await objectGatewayClient().getStream(
                    claims.ownerClusterId,
                    claims.bucket,
                    claims.objectKey,
                    {
                        skipMetadata: true,
                        ...(rangeHeader ? { rangeHeader } : {})
                    }
                );

                applyReadHeaders(response, streamResponse);
                response.status(streamResponse.headers['content-range'] ? 206 : 200);
                await pipeline(streamResponse.stream, response);
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
