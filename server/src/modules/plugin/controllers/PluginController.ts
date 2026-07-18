import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import PluginService from '@modules/plugin/services/PluginService';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';

import { ErrorCodes } from '@core/constants/error-codes';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import multer from 'multer';

import type { ClonePluginInputDTO } from '@modules/plugin/dtos/plugin/ClonePluginDTO';
import type { CreatePluginInputDTO } from '@modules/plugin/dtos/plugin/CreatePluginDTO';
import type { DeleteBinaryInputDTO } from '@modules/plugin/dtos/plugin/DeleteBinaryDTO';
import type { DeletePluginByIdInputDTO } from '@modules/plugin/dtos/plugin/DeletePluginByIdDTO';
import type { DownloadPluginBinaryInputDTO } from '@modules/plugin/dtos/plugin/DownloadPluginBinaryDTO';
import type { ExecutePipelineInputDTO } from '@modules/plugin/dtos/plugin/ExecutePipelineDTO';
import type { ExportPluginInputDTO } from '@modules/plugin/dtos/plugin/ExportPluginDTO';
import type { GetPluginByIdInputDTO } from '@modules/plugin/dtos/plugin/GetPluginByIdDTO';
import type { ImportPluginInputDTO } from '@modules/plugin/dtos/plugin/ImportPluginDTO';
import type { ListPluginsInputDTO } from '@modules/plugin/dtos/plugin/ListPluginsDTO';
import type { RegistryInstallPluginInputDTO } from '@modules/plugin/dtos/plugin/RegistryInstallPluginDTO';
import type { SearchRegistryPluginsInputDTO } from '@modules/plugin/dtos/plugin/SearchRegistryPluginsDTO';
import type { UpdatePluginByIdInputDTO } from '@modules/plugin/dtos/plugin/UpdatePluginByIdDTO';
import type { CommitBinaryUploadInputDTO, UploadBinaryInputDTO } from '@modules/plugin/dtos/plugin/UploadBinaryDTO';
import type { ValidateWorkflowInputDTO } from '@modules/plugin/dtos/plugin/ValidateWorkflowDTO';
import type { GetPluginExposureChartInputDTO } from '@modules/plugin/dtos/exposure/GetPluginExposureChartDTO';
import type { GetPluginExposureExportInputDTO } from '@modules/plugin/dtos/exposure/GetPluginExposureExportDTO';
import type { GetPluginExposureGLBInputDTO } from '@modules/plugin/dtos/exposure/GetPluginExposureGLBDTO';
import type { GetAnalysisListingExportOptionsInputDTO } from '@modules/plugin/dtos/listing-row/GetAnalysisListingExportOptionsDTO';
import type {
    ExportListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdInputDTO
} from '@modules/plugin/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import type {
    ExportPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsInputDTO
} from '@modules/plugin/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { GetSubListingInputDTO } from '@modules/plugin/dtos/listing-row/GetSubListingDTO';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { NextFunction, Request, Response } from 'express';
import type { Readable } from 'node:stream';

const IMPORT_MAX_FILE_SIZE = 100 * 1024 * 1024;

const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: IMPORT_MAX_FILE_SIZE
    }
});

/**
 * Caps the in-memory import buffer at {@link IMPORT_MAX_FILE_SIZE}. multer aborts
 * streaming once the cap is exceeded, so an oversized (or zip-bomb) upload never
 * gets fully buffered + unzipped in RAM. A `MulterError` carries no `statusCode`,
 * so it would normalize to a 500 in the global error middleware — surface the
 * size violation as a 400 here instead (matching `uploadChatSingleFile`) and let
 * every other error propagate unchanged. Moved verbatim from the deleted
 * `routes/plugin` module so `importPlugin` keeps its route-level upload guard.
 */
const importUploadSingleFile = (fieldName: string) => (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    importUpload.single(fieldName)(request, response, (error: unknown) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return BaseResponse.error(
                response,
                'File exceeds the allowed upload size.',
                HttpStatus.BadRequest,
                ErrorCodes.FILE_READ_ERROR
            );
        }

        return next(error);
    });
};

/**
 * The single HTTP controller for the plugin module (pollium style): every route
 * is bound with `@Route(pluginRoutes.x)` and delegates to a {@link PluginService}
 * the controller `new`s itself. The class-level
 * `@Middleware(protect, teamScoped(Resource.PLUGIN))` replaces the old mount-time
 * auth + team-scope layer that the three `createHttpModule` route files carried.
 * `buildRouter()` turns the decorated methods into the Express router mounted
 * directly in `mount-http-routes` (contract paths are absolute).
 *
 * Route declaration order mirrors the previous mount order (listing-row +
 * exposure modules mounted BEFORE the plugin module), so Express matches the
 * literal `/listings/*` and `/exposures/*` families before the plugin
 * `/:pluginId` catch-alls.
 *
 * The download/export routes (`exportPlugin`, `downloadBinary`, the three
 * `getPluginExposure*` routes, and the two listing-row exports) take `@Res()` /
 * `@Req()`, await the optional `prepare()`, apply the prepared headers and pipe
 * the binary stream themselves — reproducing the old
 * `createPreparedDownloadStreamController` behaviour. `removeBinary` / `remove`
 * keep the empty-body `NoContent` behaviour.
 */
@Middleware(protect, teamScoped(Resource.PLUGIN))
export default class PluginController extends Controller {
    #service = new PluginService();

    /**
     * Reproduces `BaseStreamController.handleSuccess`: applies the response
     * headers, wires request-close and stream-error handlers, then pipes. The
     * returned promise resolves once the response has finished (or was closed /
     * errored) so the awaiting handler returns only after the response has been
     * written — the {@link Controller} base then no-ops on its `headersSent`
     * guard.
     */
    #pipeStream(res: Response, stream: Readable, headers: Record<string, string>): Promise<void> {
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

    // -- listing-row (declared first) --------------------------------------

    @Route(pluginRoutes.getListingRowsByAnalysisId)
    async getListingRowsByAnalysisId(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetListingRowsByAnalysisIdInputDTO;
        const value = await this.#service.getListingRowsByAnalysisId(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.getAnalysisListingExportOptions)
    async getAnalysisListingExportOptions(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetAnalysisListingExportOptionsInputDTO;
        const value = await this.#service.getAnalysisListingExportOptions(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportListingRowsByAnalysisId)
    async exportListingRowsByAnalysisId(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as ExportListingRowsByAnalysisIdInputDTO;
        const output = await this.#service.exportListingRowsByAnalysisId(input);
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getSubListing)
    async getSubListing(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetSubListingInputDTO;
        const value = await this.#service.getSubListing(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportPluginListingDocuments)
    @Route(pluginRoutes.exportPluginListingDocumentsByTrajectory)
    async exportPluginListingDocuments(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as ExportPluginListingDocumentsInputDTO;
        const output = await this.#service.exportPluginListingDocuments(input);
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginListingDocuments)
    async getPluginListingDocuments(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetPluginListingDocumentsInputDTO;
        const value = await this.#service.getPluginListingDocuments(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    // -- exposure ----------------------------------------------------------

    @Route(pluginRoutes.getPluginExposureGLB)
    async getPluginExposureGLB(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetPluginExposureGLBInputDTO;
        const output = await this.#service.getPluginExposureGLB(input);
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginExposureChart)
    async getPluginExposureChart(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetPluginExposureChartInputDTO;
        const output = await this.#service.getPluginExposureChart(input);
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginExposureExport)
    async getPluginExposureExport(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetPluginExposureExportInputDTO;
        const output = await this.#service.getPluginExposureExport(input);
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    // -- plugin ------------------------------------------------------------

    @Route(pluginRoutes.getNodeTypesSchema)
    async getNodeTypesSchema(@Res() res: Response): Promise<void> {
        const value = await this.#service.getNodeTypesSchema();
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.validateWorkflow)
    async validateWorkflow(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as ValidateWorkflowInputDTO;
        const value = await this.#service.validateWorkflow(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportPlugin)
    async exportPlugin(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as ExportPluginInputDTO;
        const output = await this.#service.exportPlugin(input);
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.importPlugin)
    @Middleware(importUploadSingleFile('file'))
    async importPlugin(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as ImportPluginInputDTO;
        const value = await this.#service.importPlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.searchRegistry)
    async searchRegistry(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as SearchRegistryPluginsInputDTO;
        const value = await this.#service.searchRegistry(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.installRegistry)
    async installRegistry(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as RegistryInstallPluginInputDTO;
        const value = await this.#service.installRegistry(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.list)
    async listPlugins(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as ListPluginsInputDTO;
        const value = await this.#service.listPlugins(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.create)
    async create(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as CreatePluginInputDTO;
        const value = await this.#service.createPlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.commitBinaryUpload)
    async commitBinaryUpload(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as CommitBinaryUploadInputDTO;
        const value = await this.#service.commitBinaryUpload(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.downloadBinary)
    async downloadBinary(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as DownloadPluginBinaryInputDTO;
        const output = await this.#service.downloadBinary(input);
        await output.prepare?.();
        await this.#pipeStream(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.uploadBinary)
    async uploadBinary(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as UploadBinaryInputDTO;
        const value = await this.#service.uploadBinary(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.removeBinary)
    async deleteBinary(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as DeleteBinaryInputDTO;
        await this.#service.deleteBinary(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.clone)
    async clone(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as ClonePluginInputDTO;
        const value = await this.#service.clonePlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.get)
    async getPluginById(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as GetPluginByIdInputDTO;
        const value = await this.#service.getPluginById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.update)
    async updatePluginById(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as UpdatePluginByIdInputDTO;
        const value = await this.#service.updatePluginById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.remove)
    async deleteById(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        const input = buildControllerParams(req) as unknown as DeletePluginByIdInputDTO;
        await this.#service.deletePluginById(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.executePipeline)
    async executePipeline(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        // `buildControllerParams` injects `userId` from the authenticated request,
        // matching the former `withAuthenticatedUserId` extendParams.
        const input = buildControllerParams(req) as unknown as ExecutePipelineInputDTO;
        const value = await this.#service.executePipeline(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
