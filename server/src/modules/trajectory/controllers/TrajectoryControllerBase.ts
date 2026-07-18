import Controller from '@shared/http/Controller';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { encodeAtomsBinary } from '@modules/trajectory/utilities/atoms/encode-atoms-binary';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type { GetAtomsColumnarInputDTO, GetAtomsColumnarOutputDTO } from '@modules/trajectory/contracts/trajectory/ServiceTypes';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

const getParamValue = (value: string | string[] | undefined): string => (
    (Array.isArray(value) ? value[0] : value) as string
);

const getOptionalNumber = (value: unknown): number | undefined => (
    value ? Number(value) : undefined
);

const readAcceptEncoding = (req: AuthenticatedRequest): string | undefined => {
    const header = req.headers['accept-encoding'];

    if (Array.isArray(header)) {
        return header.join(',');
    }

    return header;
};

export default abstract class TrajectoryControllerBase extends Controller {
    protected readonly service = new TrajectoryService();

    protected params<T>(
        req: AuthenticatedRequest,
        extend?: (req: AuthenticatedRequest, params: Record<string, unknown>) => Record<string, unknown>
    ): T {
        return buildControllerParams(req, extend) as unknown as T;
    }

    protected withAuthenticatedUserId = (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ): Record<string, unknown> => ({
        ...params,
        userId: req.userId
    });

    protected withOptionalUserId = (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ): Record<string, unknown> => ({
        ...params,
        userId: req.authType === AuthenticationType.User ? req.userId : undefined
    });

    protected withGlbRequestContext = (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ): Record<string, unknown> => ({
        ...this.withOptionalUserId(req, params),
        acceptEncoding: readAcceptEncoding(req)
    });

    protected sendPaginated(res: Response, value: PaginatedResult<unknown>): void {
        BaseResponse.paginated(res, value, value._meta);
    }

    
    protected pipeStream(res: Response, stream: Readable, headers: Record<string, string>): Promise<void> {
        return new Promise<void>((resolve) => {
            for (const [name, value] of Object.entries(headers)) {
                res.setHeader(name, value);
            }

            res.on('close', () => {
                stream.destroy();
                resolve();
            });

            res.on('finish', () => {
                resolve();
            });

            stream.on('error', (error: unknown) => {
                logger.error(error);

                if (!res.headersSent) {
                    BaseResponse.fromError(res, error);
                } else {
                    res.destroy(error instanceof Error ? error : undefined);
                }

                resolve();
            });

            stream.pipe(res);
        });
    }

    
    protected defaultStreamHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        };
    }

    
    protected passthroughModelHeaders(value: {
        stream?: unknown;
        contentEncoding?: string;
        contentLength?: number;
    }): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Cache-Control': 'public, max-age=31536000, immutable'
        };

        if (value.contentEncoding && value.contentEncoding !== 'identity') {
            headers['X-Volt-Resource-Encoding'] = value.contentEncoding;
        }

        if (typeof value.contentLength === 'number' && value.contentLength > 0) {
            headers['Content-Length'] = String(value.contentLength);
        }

        return headers;
    }

    protected validateAtomsRequest(req: AuthenticatedRequest, res: Response): boolean {
        const fmt = typeof req.query.fmt === 'string' ? req.query.fmt : undefined;
        if (fmt !== 'bin') {
            BaseResponse.error(
                res,
                'Unsupported format: expected ?fmt=bin',
                HttpStatus.BadRequest,
                'TRAJECTORY::ATOMS_UNSUPPORTED_FORMAT'
            );
            return false;
        }

        const timestep = Number(req.params.timestep);
        if (!Number.isFinite(timestep) || timestep < 0) {
            BaseResponse.error(
                res,
                'Invalid timestep',
                HttpStatus.BadRequest,
                'TRAJECTORY::INVALID_TIMESTEP'
            );
            return false;
        }

        return true;
    }

    protected buildAtomsInput(req: AuthenticatedRequest): GetAtomsColumnarInputDTO {
        return {
            trajectoryId: getParamValue(req.params.trajectoryId),
            timestep: Number(req.params.timestep),
            page: getOptionalNumber(req.query.page),
            limit: getOptionalNumber(req.query.limit),
            analysisId: typeof req.query.analysisId === 'string' ? req.query.analysisId : undefined
        };
    }

    protected sendAtomsBinary(res: Response, value: GetAtomsColumnarOutputDTO): void {
        const body = encodeAtomsBinary(value);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', String(body.byteLength));
        res.setHeader('X-Atom-Total', String(value.total));
        res.setHeader('X-Atom-Page', String(value.page));
        res.setHeader('X-Atom-Limit', String(value.limit));
        res.setHeader('X-Atom-Total-Pages', String(value.totalPages));
        res.setHeader('X-Atom-Properties', value.propertyNames.join(','));
        res.status(HttpStatus.OK).end(body);
    }
}
