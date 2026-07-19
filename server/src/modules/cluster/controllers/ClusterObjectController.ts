import Controller from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import ClusterObjectTransferService, {
    type ClusterObjectTransferReadResponse
} from '@modules/cluster/services/ClusterObjectTransferService';
import { clusterObjectRoutes } from '@volt/contracts/modules/cluster/routes';
import { pipeline } from 'node:stream/promises';

import type { Request, Response } from 'express';

const readRouteParam = (request: Request, paramName: 'teamId' | 'token'): string | undefined => {
    const value = request.params[paramName];
    return Array.isArray(value) ? value[0] : value;
};

const readContentLength = (request: Request): number | undefined => {
    const rawContentLength = request.header('content-length');
    return rawContentLength ? Number(rawContentLength) : undefined;
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

const applyReadHeaders = (
    response: Response,
    streamResponse: ClusterObjectTransferReadResponse
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

export default class ClusterObjectController extends Controller {
    readonly #transferService = new ClusterObjectTransferService();

    @Route(clusterObjectRoutes.write)
    async write(@Req() request: Request, @Res() response: Response): Promise<void> {
        try {
            await this.#transferService.write(
                readRouteParam(request, 'teamId'),
                readRouteParam(request, 'token'),
                {
                    stream: request,
                    contentLength: readContentLength(request),
                    contentType: request.header('content-type') || undefined,
                    contentEncoding: request.header('content-encoding') || undefined
                }
            );

            response.status(201).end();
        } catch (error) {
            if (!response.headersSent) {
                sendError(response, error);
                return;
            }

            response.destroy(error instanceof Error ? error : undefined);
        }
    }

    @Route(clusterObjectRoutes.readHead)
    async readHead(@Req() request: Request, @Res() response: Response): Promise<void> {
        try {
            const head = await this.#transferService.head(
                readRouteParam(request, 'teamId'),
                readRouteParam(request, 'token')
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
    }

    @Route(clusterObjectRoutes.read)
    async read(@Req() request: Request, @Res() response: Response): Promise<void> {
        try {
            const rangeHeader = request.header('range') || undefined;
            const streamResponse = await this.#transferService.openRead(
                readRouteParam(request, 'teamId'),
                readRouteParam(request, 'token'),
                rangeHeader ? { rangeHeader } : undefined
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
    }
}
