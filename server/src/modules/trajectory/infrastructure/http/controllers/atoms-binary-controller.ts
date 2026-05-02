import { encodeAtomsBinary } from '@modules/trajectory/utilities/atoms/encode-atoms-binary';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { container, injectable } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';
import type {
    GetAtomsColumnarInputDTO,
    GetAtomsColumnarOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import type { Response } from 'express';

type AtomsBinaryUseCase<TInput extends GetAtomsColumnarInputDTO> = IUseCase<
    TInput,
    GetAtomsColumnarOutputDTO,
    ApplicationError
>;

interface AtomsBinaryControllerOptions<TInput extends GetAtomsColumnarInputDTO> {
    extendInput?: (
        req: AuthenticatedRequest,
        input: GetAtomsColumnarInputDTO
    ) => TInput;
}

const getParamValue = (value: string | string[] | undefined): string => (
    (Array.isArray(value) ? value[0] : value) as string
);

const getOptionalNumber = (value: unknown): number | undefined => (
    value ? Number(value) : undefined
);

const sendAtomsBinary = (
    res: Response,
    value: GetAtomsColumnarOutputDTO
): void => {
    const body = encodeAtomsBinary(value);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(body.byteLength));
    res.setHeader('X-Atom-Total', String(value.total));
    res.setHeader('X-Atom-Page', String(value.page));
    res.setHeader('X-Atom-Limit', String(value.limit));
    res.setHeader('X-Atom-Total-Pages', String(value.totalPages));
    res.setHeader('X-Atom-Properties', value.propertyNames.join(','));
    res.status(HttpStatus.OK).end(body);
};

export const createAtomsBinaryController = <TInput extends GetAtomsColumnarInputDTO>(
    useCaseToken: InjectionToken<AtomsBinaryUseCase<TInput>>,
    options: AtomsBinaryControllerOptions<TInput> = {}
) => {
    @injectable()
    class AtomsBinaryController {
        private readonly useCase: AtomsBinaryUseCase<TInput>;

        constructor() {
            this.useCase = container.resolve(useCaseToken);
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

            const baseInput: GetAtomsColumnarInputDTO = {
                trajectoryId: getParamValue(req.params.trajectoryId),
                timestep,
                page: getOptionalNumber(req.query.page),
                limit: getOptionalNumber(req.query.limit),
                analysisId: typeof req.query.analysisId === 'string' ? req.query.analysisId : undefined
            };
            const input = options.extendInput
                ? options.extendInput(req, baseInput)
                : baseInput as TInput;

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

            sendAtomsBinary(res, result.value);
        }
    }

    return AtomsBinaryController;
};
