import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { encodeAtomsBinary } from '@modules/trajectory/utilities/atoms/encode-atoms-binary';

import { container, injectable } from 'tsyringe';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { GetAtomsColumnarInputDTO } from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import type { Response } from 'express';

@injectable()
export default class GetAtomsBinaryController {
    private readonly useCase: GetAtomsUseCase;

    constructor() {
        this.useCase = container.resolve(GetAtomsUseCase);
        this.handle = this.handle.bind(this);
    }

    async handle(req: AuthenticatedRequest, res: Response): Promise<void> {
        const fmt = typeof req.query.fmt === 'string' ? req.query.fmt : undefined;
        if (fmt !== 'bin') {
            BaseResponse.error(
                res,
                'Unsupported format: expected ?fmt=bin',
                HttpStatus.BadRequest,
                'TRAJECTORY::ATOMS_UNSUPPORTED_FORMAT'
            );
            return;
        }

        const trajectoryId = Array.isArray(req.params.trajectoryId)
            ? req.params.trajectoryId[0]
            : req.params.trajectoryId;
        const timestep = Number(req.params.timestep);
        if (!Number.isFinite(timestep) || timestep < 0) {
            BaseResponse.error(
                res,
                'Invalid timestep',
                HttpStatus.BadRequest,
                'TRAJECTORY::INVALID_TIMESTEP'
            );
            return;
        }

        const page = req.query.page ? Number(req.query.page) : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const analysisId = typeof req.query.analysisId === 'string' ? req.query.analysisId : undefined;

        const input: GetAtomsColumnarInputDTO = {
            trajectoryId,
            timestep,
            page,
            limit,
            analysisId
        };

        const result = await this.useCase.execute(input);
        if (!result.success) {
            BaseResponse.error(
                res,
                result.error.message,
                result.error.statusCode ?? HttpStatus.InternalServerError,
                result.error.code
            );
            return;
        }

        const body = encodeAtomsBinary(result.value);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', String(body.byteLength));
        res.setHeader('X-Atom-Total', String(result.value.total));
        res.setHeader('X-Atom-Page', String(result.value.page));
        res.setHeader('X-Atom-Limit', String(result.value.limit));
        res.setHeader('X-Atom-Total-Pages', String(result.value.totalPages));
        // Why: the property list is also exposed as a header so the client can
        // surface column metadata before parsing the body (useful for the
        // canvas pipeline, which dispatches decoders by name).
        res.setHeader('X-Atom-Properties', result.value.propertyNames.join(','));
        res.status(HttpStatus.OK).end(body);
    }
};
