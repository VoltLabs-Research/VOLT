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

import type {
    ClonePluginInputDTO,
    CreatePluginInputDTO,
    DeleteBinaryInputDTO,
    DeletePluginByIdInputDTO,
    DownloadPluginBinaryInputDTO,
    ExecutePipelineInputDTO,
    ExportPluginInputDTO,
    ImportPluginInputDTO,
    ListPluginsInputDTO,
    RegistryInstallPluginInputDTO,
    SearchRegistryPluginsInputDTO,
    UpdatePluginByIdInputDTO,
    CommitBinaryUploadInputDTO,
    UploadBinaryInputDTO,
    ValidateWorkflowInputDTO,
    GetPluginExposureChartInputDTO
} from '@modules/plugin/services/PluginService';
import type { GetPluginByIdInputDTO } from '@shared/contracts/dtos/GetPluginByIdDTO';
import type { GetPluginExposureExportInputDTO } from '@shared/contracts/dtos/GetPluginExposureExportDTO';
import type { GetPluginExposureGLBInputDTO } from '@shared/contracts/dtos/GetPluginExposureGLBDTO';
import type {
    GetAnalysisListingExportOptionsInputDTO,
    ExportListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdInputDTO
} from '@modules/plugin/utilities/listing-row/listing-row-types';
import type {
    ExportPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsInputDTO
} from '@shared/contracts/dtos/GetPluginListingDocumentsDTO';
import type { GetSubListingInputDTO } from '@shared/contracts/dtos/GetSubListingDTO';
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

@Middleware(protect, teamScoped(Resource.PLUGIN))
export default class PluginController extends Controller {
    #service = new PluginService();

    
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
        
        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.executePipeline)
    async executePipeline(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        
        
        const input = buildControllerParams(req) as unknown as ExecutePipelineInputDTO;
        const value = await this.#service.executePipeline(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
