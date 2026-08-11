import Controller from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import ClusterObjectTransferService from '@modules/cluster/services/object-store/ClusterObjectTransferService';
import {
    applyObjectHeaders,
    applyRangeHeaders,
    isPartialContent,
    readContentLength,
    sendObjectError
} from '@modules/cluster/controllers/cluster-object-http';
import { clusterObjectRoutes } from '@volt/contracts/modules/cluster/routes';
import { pipeline } from 'node:stream/promises';

import type { Request, Response } from 'express';

const GATEWAY_FAILURE = {
    code: 'ClusterObject::GatewayFailed',
    message: 'Object gateway request failed'
};

/** Express types route params as `string | string[]`, so the array form must be narrowed. */
const readRouteParam = (request: Request, paramName: 'teamId' | 'token'): string | undefined => {
    const value = request.params[paramName];
    return Array.isArray(value) ? value[0] : value;
};

export default class ClusterObjectController extends Controller {
    readonly #transferService = new ClusterObjectTransferService();

    @Route(clusterObjectRoutes.write)
    async write(
        @Req() request: Request,
        @Res() response: Response
    ): Promise<void>{
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
        } catch (error: unknown) {
            this.#failResponse(response, error);
        }
    }

    @Route(clusterObjectRoutes.readHead)
    async readHead(
        @Req() request: Request,
        @Res() response: Response
    ): Promise<void>{
        try {
            const head = await this.#transferService.head(readRouteParam(request, 'teamId'), readRouteParam(request, 'token'));

            applyObjectHeaders(response, head);
            response.status(200).end();
        } catch (error: unknown) {
            this.#failResponse(response, error);
        }
    }

    @Route(clusterObjectRoutes.read)
    async read(
        @Req() request: Request,
        @Res() response: Response
    ): Promise<void>{
        try {
            const rangeHeader = request.header('range') || undefined;
            const streamResponse = await this.#transferService.openRead(
                readRouteParam(request, 'teamId'),
                readRouteParam(request, 'token'),
                rangeHeader ? { rangeHeader } : undefined
            );

            applyObjectHeaders(response, streamResponse);
            applyRangeHeaders(response, streamResponse.headers);
            response.setHeader('cache-control', 'private, max-age=900');
            response.setHeader('x-content-type-options', 'nosniff');
            response.status(isPartialContent(streamResponse.headers) ? 206 : 200);
            await pipeline(streamResponse.stream, response);
        } catch (error: unknown) {
            this.#failResponse(response, error);
        }
    }

    /** Once bytes are on the wire the only way to signal failure is to tear the socket down. */
    #failResponse(response: Response, error: unknown): void {
        if (!response.headersSent) {
            sendObjectError(response, error, GATEWAY_FAILURE);
            return;
        }

        response.destroy(error instanceof Error ? error : undefined);
    }
}
