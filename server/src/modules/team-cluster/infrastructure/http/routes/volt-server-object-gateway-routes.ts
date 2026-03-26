import VoltServerObjectGatewayService from '@modules/team-cluster/infrastructure/services/VoltServerObjectGatewayService';
import { TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER } from '@shared/infrastructure/contracts/team-cluster';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { container } from 'tsyringe';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';

const service = (): VoltServerObjectGatewayService => {
    return container.resolve(VoltServerObjectGatewayService);
};

const readDirectAccessToken = (request: Request): string | null => {
    const token = request.header(TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER);
    return typeof token === 'string' && token.trim().length > 0
        ? token.trim()
        : null;
};

const decodePathComponent = (value: string, fieldName: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        throw ApplicationError.badRequest(
            'TeamCluster::DirectAccessInvalidPath',
            `${fieldName} contains invalid path encoding`
        );
    }
};

const resolveObjectRoute = (pathname: string): { bucket: string; objectKey: string; } => {
    const bucketsPath = '/buckets/';
    if (!pathname.startsWith(bucketsPath)) {
        throw ApplicationError.notFound(
            'TeamCluster::DirectAccessRouteNotFound',
            'Object gateway route not found'
        );
    }

    const bucketPath = pathname.slice(bucketsPath.length);
    const firstSlashIndex = bucketPath.indexOf('/');
    if (firstSlashIndex < 0) {
        throw ApplicationError.notFound(
            'TeamCluster::DirectAccessRouteNotFound',
            'Object gateway route not found'
        );
    }

    const bucket = decodePathComponent(bucketPath.slice(0, firstSlashIndex), 'bucket');
    const remainder = bucketPath.slice(firstSlashIndex);
    if (!remainder.startsWith('/objects/')) {
        throw ApplicationError.notFound(
            'TeamCluster::DirectAccessRouteNotFound',
            'Object gateway route not found'
        );
    }

    const encodedObjectKey = remainder.slice('/objects/'.length);
    if (!encodedObjectKey) {
        throw ApplicationError.badRequest(
            'TeamCluster::DirectAccessObjectKeyRequired',
            'objectKey is required'
        );
    }

    return {
        bucket,
        objectKey: decodePathComponent(encodedObjectKey, 'objectKey')
    };
};

const sendError = (response: Response, error: unknown): void => {
    const message = error instanceof Error ? error.message : 'Unexpected direct access error';
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'TeamCluster::DirectAccessFailed';
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

export default createHttpModule({
    basePath: '/internal/object-gateway/v1',
    routes: (router) => {
        router.use(async (request, response) => {
            try {
                if (request.method !== 'HEAD' && request.method !== 'GET') {
                    response.setHeader('allow', 'GET, HEAD');
                    throw new ApplicationError(
                        'TeamCluster::DirectAccessMethodNotAllowed',
                        'Method not allowed',
                        405
                    );
                }

                const token = readDirectAccessToken(request);
                if (!token) {
                    throw ApplicationError.unauthorized(
                        'TeamCluster::DirectAccessTokenRequired',
                        'A direct access token is required'
                    );
                }

                const claims = service().verifyToken(token);
                if (!claims) {
                    throw ApplicationError.unauthorized(
                        'TeamCluster::DirectAccessTokenInvalid',
                        'The provided direct access token is invalid or expired'
                    );
                }

                const resolvedRoute = resolveObjectRoute(request.path);
                if (request.method === 'HEAD') {
                    const head = await service().getObjectHead(
                        claims.teamId,
                        resolvedRoute.bucket,
                        resolvedRoute.objectKey
                    );
                    service().applyResponseHeaders(head, (name, value) => {
                        response.setHeader(name, value);
                    });
                    response.status(200).end();
                    return;
                }

                const streamResponse = await service().getObjectStream(
                    claims.teamId,
                    resolvedRoute.bucket,
                    resolvedRoute.objectKey
                );
                service().applyResponseHeaders(streamResponse, (name, value) => {
                    response.setHeader(name, value);
                });
                response.status(200);
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
