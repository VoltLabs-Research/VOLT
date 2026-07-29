import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Param, Query, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import RasterService from '@modules/raster/services/RasterService';
import { rasterRoutes } from '@volt/contracts/modules/raster/routes';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import type { Response } from 'express';

@Middleware(protect, teamScoped(Resource.RASTER))
export default class RasterController extends Controller {
    #service = new RasterService();

    @Route(rasterRoutes.triggerRasterization)
    @Status(202)
    triggerRasterization(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryId: string
    ){
        return this.#service.triggerRasterization({
            trajectoryId,
            teamId
        });
    }

    @Route(rasterRoutes.getRasterMetadata)
    getRasterMetadata(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryId: string
    ){
        return this.#service.getRasterMetadata({
            trajectoryId,
            teamId
        });
    }

    @Route(rasterRoutes.getRasterFramePNG)
    async getRasterFramePNG(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryId: string,
        @Param('timestep') timestep: string,
        @Query('analysisId') analysisId: string | undefined,
        @Query('model') model: string | undefined,
        @Res() res: Response
    ): Promise<void> {
        const output = await this.#service.getRasterFramePNG({
            trajectoryId,
            teamId,
            timestep: Number(timestep),
            analysisId,
            model
        });

        await output.prepare?.();
        await this.#pipeStream(res, output);
    }

    #pipeStream(res: Response, output: DownloadStreamOutput): Promise<void> {
        return new Promise<void>((resolve) => {
            for (const [name, value] of Object.entries(output.headers)) {
                res.setHeader(name, value);
            }

            res.on('close', () => {
                output.stream.destroy();
                resolve();
            });

            res.on('finish', () => {
                resolve();
            });

            output.stream.on('error', (error: unknown) => {
                logger.error(error);

                if (!res.headersSent) {
                    BaseResponse.fromError(res, error);
                } else {
                    res.destroy(error instanceof Error ? error : undefined);
                }

                resolve();
            });

            output.stream.pipe(res);
        });
    }
}
