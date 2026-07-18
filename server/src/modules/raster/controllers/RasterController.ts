import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Param, Res } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import RasterService from '@modules/raster/services/RasterService';
import { rasterRoutes } from '@volt/contracts/modules/raster/routes';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types';
import type { Response } from 'express';

/**
 * The single HTTP controller for the raster module (pollium style): every route
 * is bound with `@Route(rasterRoutes.x)` and delegates to a {@link RasterService}
 * the controller `new`s itself. The class-level
 * `@Middleware(protect, teamScoped(Resource.RASTER))` replaces the old mount-time
 * auth + team-scope layer (`basePath /api/rasters/:teamId`, `resource RASTER`).
 * `triggerRasterization` returns 202 (Accepted) via `@Status`.
 * `getRasterFramePNG` handles BOTH the frame-only and analysis+model wire routes
 * and streams the PNG via `@Res()`, reproducing the former prepared-download
 * stream controller verbatim (prepare → headers → close/error handlers → pipe);
 * because it writes and awaits the response itself, the `Controller` base's
 * responder no-ops on its `headersSent`/`writableEnded` guard.
 */
@Middleware(protect, teamScoped(Resource.RASTER))
export default class RasterController extends Controller {
    #service = new RasterService();

    @Route(rasterRoutes.triggerRasterization)
    @Status(202)
    triggerRasterization(@Param('teamId') teamId: string, @Param('trajectoryId') trajectoryId: string) {
        return this.#service.triggerRasterization({ trajectoryId, teamId });
    }

    @Route(rasterRoutes.getRasterMetadata)
    getRasterMetadata(@Param('teamId') teamId: string, @Param('trajectoryId') trajectoryId: string) {
        return this.#service.getRasterMetadata({ trajectoryId, teamId });
    }

    @Route(rasterRoutes.getRasterFramePNG)
    @Route(rasterRoutes.getRasterFrameAnalysisPNG)
    async getRasterFramePNG(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryId: string,
        @Param('timestep') timestep: string,
        @Param('analysisId') analysisId: string | undefined,
        @Param('model') model: string | undefined,
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

    #pipeStream(res: Response, output: DownloadStreamOutputDTO): Promise<void> {
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
