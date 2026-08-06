import Controller from '@shared/http/Controller';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { buildControllerParams, readAcceptEncoding } from '@shared/infrastructure/http/controllers/controller-internals';
import { encodeAtomsBinary } from '@modules/trajectory/controllers/atoms-binary-format';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { AuthenticationType } from '@shared/contracts/types/AuthenticatedRequest';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';

import type {
    GetAtomsColumnarInput,
    GetAtomsColumnarOutput
} from '@modules/trajectory/services/TrajectoryServiceTypes';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';

/** Express 5 types every route param as `string | string[]`, because a segment can repeat. */
const readRouteParam = (value: string | string[]): string => (
    Array.isArray(value) ? value[0] : value
);

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

    protected defaultStreamHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000'
        };
    }

    /** Single source of truth for the GLB response headers of every canvas model route. */
    protected passthroughModelHeaders(value: {
        contentEncoding?: string;
        negotiatedContentEncoding?: string | null;
        contentLength?: number;
        objectName?: string;
        etag?: string;
        lastModified?: Date;
    } = {}): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Cache-Control': 'public, max-age=31536000, immutable'
        };

        if (value.objectName) {
            headers['Content-Disposition'] = `attachment; filename="${value.objectName}"`;
        }

        if (value.contentEncoding && value.contentEncoding !== 'identity') {
            headers['X-Volt-Resource-Encoding'] = value.contentEncoding;
        }

        /*
         * Standard `Content-Encoding` is only safe once the client advertised the
         * codec, so callers negotiate it and pass the result rather than deriving
         * it from the stored object. `Vary` matters more than usual here: the
         * response is `immutable`, so a shared cache that ignored it could hand an
         * encoded body to a client that never asked for one.
         */
        if (value.negotiatedContentEncoding) {
            headers['Content-Encoding'] = value.negotiatedContentEncoding;
            headers['Vary'] = 'Accept-Encoding';
        }

        if ((value.contentLength ?? 0) > 0) {
            headers['Content-Length'] = String(value.contentLength);
        }

        /*
         * Validators are forwarded, but no conditional handling is implemented here:
         * these responses are `immutable`, so browsers do not revalidate anyway, and
         * the value is in giving shared caches something to key on.
         */
        if (value.etag) {
            headers['ETag'] = value.etag;
        }

        if (value.lastModified) {
            headers['Last-Modified'] = value.lastModified.toUTCString();
        }

        return headers;
    }

    protected validateAtomsRequest(req: AuthenticatedRequest, res: Response): boolean {
        const fmt = typeof req.query.fmt === 'string' ? req.query.fmt : undefined;
        if (fmt !== undefined && fmt !== 'bin') {
            BaseResponse.error(
                res,
                'Unsupported format: expected bin',
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

    protected buildAtomsInput(req: AuthenticatedRequest): GetAtomsColumnarInput {
        return {
            trajectoryId: readRouteParam(req.params.trajectoryId),
            timestep: Number(req.params.timestep),
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            analysisId: typeof req.query.analysisId === 'string' ? req.query.analysisId : undefined
        };
    }

    protected sendAtomsBinary(res: Response, value: GetAtomsColumnarOutput): void {
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
