import type RasterService from '@modules/raster/application/RasterService';
import type { GetRasterFramePNGInputDTO } from '@modules/raster/application/dtos/GetRasterFramePNGDTO';
import type { TriggerRasterizationInputDTO } from '@modules/raster/application/dtos/TriggerRasterizationDTO';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import type { GetRasterMetadataInputDTO } from '@shared/contracts/dtos/GetRasterMetadataDTO';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the raster module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did
 * for the generated controllers, delegating to {@link RasterService}, and
 * responding via {@link BaseResponse}. `getRasterFramePNG` reproduces the
 * former `createPreparedDownloadStreamController` behaviour verbatim: it awaits
 * the prepared output's `prepare()`, applies the response's `headers`, wires the
 * request-close and stream-error handlers, then pipes the binary stream to the
 * response. Handlers are arrow-function properties so `this` stays bound when
 * passed by reference to the router.
 */
@injectable()
export default class RasterController {
    constructor(
        @inject(RASTER_TOKENS.RasterService) private readonly rasterService: RasterService
    ) {}

    triggerRasterization = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as TriggerRasterizationInputDTO;
        const value = await this.rasterService.triggerRasterization(input);
        BaseResponse.success(res, value, HttpStatus.Accepted);
    };

    getRasterMetadata = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetRasterMetadataInputDTO;
        const value = await this.rasterService.getRasterMetadata(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getRasterFramePNG = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetRasterFramePNGInputDTO;
        const output = await this.rasterService.getRasterFramePNG(input);

        await output.prepare?.();

        for (const [name, value] of Object.entries(output.headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            output.stream.destroy();
        });

        output.stream.on('error', (error: unknown) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        output.stream.pipe(res);
    };
}
