import Controller from '@shared/http/Controller';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { AuthenticationType } from '@shared/contracts/types/AuthenticatedRequest';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type {
    AtomColumnDType,
    GetAtomsColumnarInput,
    GetAtomsColumnarOutput
} from '@modules/trajectory/services/TrajectoryServiceTypes';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

const DTYPE_ID: Record<AtomColumnDType, number> = {
    f32: 0,
    u32: 1,
    u16: 2,
    str: 3,
    i32: 4
};

const DTYPE_BYTES: Record<AtomColumnDType, number> = {
    f32: 4,
    u32: 4,
    u16: 2,
    str: 1,
    i32: 4
};

const encodeAtomsBinary = (result: GetAtomsColumnarOutput): Buffer => {
    const columns = result.columns;
    const nameBuffers = columns.map((column) => Buffer.from(column.name, 'utf8'));

    let headerSize = 16 + 4 + 4;
    let dataSize = 0;

    for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        const nameBuffer = nameBuffers[i];
        if (nameBuffer.byteLength > 0xFF) {
            throw new Error(`Atom property name exceeds 255 bytes: ${column.name}`);
        }

        if (DTYPE_ID[column.dtype] === undefined) {
            throw new Error(`Unsupported atom column dtype: ${column.dtype}`);
        }

        const elementSize = DTYPE_BYTES[column.dtype];
        if (column.buffer.byteLength % elementSize !== 0) {
            throw new Error(`Atom column buffer length not aligned to dtype size: ${column.name}`);
        }

        headerSize += 1 + nameBuffer.byteLength + 1 + 4;
        dataSize += column.buffer.byteLength;
    }

    const headerSizeWithPadField = headerSize + 4;
    const padBytes = (4 - (headerSizeWithPadField % 4)) % 4;
    const envelopeSize = headerSizeWithPadField + padBytes;

    const envelope = Buffer.alloc(envelopeSize);
    let offset = 0;
    envelope.writeUInt32LE(result.total, offset);
    offset += 4;
    envelope.writeUInt32LE(result.page, offset);
    offset += 4;
    envelope.writeUInt32LE(result.limit, offset);
    offset += 4;
    envelope.writeUInt32LE(result.totalPages, offset);
    offset += 4;
    envelope.writeUInt32LE(result.count, offset);
    offset += 4;
    envelope.writeUInt32LE(columns.length, offset);
    offset += 4;

    for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        const nameBuffer = nameBuffers[i];
        envelope.writeUInt8(nameBuffer.byteLength, offset);
        offset += 1;
        nameBuffer.copy(envelope, offset);
        offset += nameBuffer.byteLength;
        envelope.writeUInt8(DTYPE_ID[column.dtype], offset);
        offset += 1;
        envelope.writeUInt32LE(column.buffer.byteLength, offset);
        offset += 4;
    }

    envelope.writeUInt32LE(padBytes, offset);
    offset += 4;

    const parts: Buffer[] = [envelope];
    for (const column of columns) {
        parts.push(Buffer.from(column.buffer.buffer, column.buffer.byteOffset, column.buffer.byteLength));
    }

    return Buffer.concat(parts, envelopeSize + dataSize);
};

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
            trajectoryId: getParamValue(req.params.trajectoryId),
            timestep: Number(req.params.timestep),
            page: getOptionalNumber(req.query.page),
            limit: getOptionalNumber(req.query.limit),
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
