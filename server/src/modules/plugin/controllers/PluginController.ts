import type PluginHttpService from '@modules/plugin/services/PluginHttpService';
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
import { PLUGIN_TOKENS } from '@modules/plugin/di/PluginTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';
import type { Readable } from 'node:stream';

/**
 * The single HTTP controller for the plugin module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did
 * for the generated controllers, delegating to {@link PluginHttpService}, and
 * responding via {@link BaseResponse}.
 *
 * The download/export routes (`exportPlugin`, `downloadBinary`, the three
 * `getPluginExposure*` routes, `exportPluginListingDocuments` and
 * `exportListingRowsByAnalysisId`) reproduce the
 * `createPreparedDownloadStreamController` behaviour byte-for-byte: await the
 * optional `prepare()`, apply the prepared `headers`, then pipe the binary
 * stream (see {@link PluginController.pipeStream}, copied from the latex/raster
 * exemplar). `deleteBinary` / `deleteById` keep the `NoContent` empty-body
 * behaviour. Handlers are arrow-function properties so `this` stays bound when
 * passed by reference to the router. Thrown `ApplicationError`s propagate to
 * `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class PluginController {
    constructor(
        @inject(PLUGIN_TOKENS.PluginHttpService) private readonly pluginService: PluginHttpService
    ) {}

    /**
     * Reproduces `BaseStreamController.handleSuccess` verbatim: applies the
     * response headers, wires the request-close and stream-error handlers, then
     * pipes the binary stream to the response.
     */
    private pipeStream(res: Response, stream: Readable, headers: Record<string, string>): void {
        for (const [name, value] of Object.entries(headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            stream.destroy();
        });

        stream.on('error', (error: unknown) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        stream.pipe(res);
    }

    // -- plugin ------------------------------------------------------------

    getNodeTypesSchema = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.pluginService.getNodeTypesSchema();
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    validateWorkflow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ValidateWorkflowInputDTO;
        const value = await this.pluginService.validateWorkflow(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    exportPlugin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ExportPluginInputDTO;
        const output = await this.pluginService.exportPlugin(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    importPlugin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ImportPluginInputDTO;
        const value = await this.pluginService.importPlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    searchRegistry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as SearchRegistryPluginsInputDTO;
        const value = await this.pluginService.searchRegistry(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    installRegistry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as RegistryInstallPluginInputDTO;
        const value = await this.pluginService.installRegistry(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    listPlugins = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListPluginsInputDTO;
        const value = await this.pluginService.listPlugins(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreatePluginInputDTO;
        const value = await this.pluginService.createPlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    commitBinaryUpload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CommitBinaryUploadInputDTO;
        const value = await this.pluginService.commitBinaryUpload(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    downloadBinary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DownloadPluginBinaryInputDTO;
        const output = await this.pluginService.downloadBinary(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    uploadBinary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UploadBinaryInputDTO;
        const value = await this.pluginService.uploadBinary(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteBinary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteBinaryInputDTO;
        await this.pluginService.deleteBinary(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    clone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ClonePluginInputDTO;
        const value = await this.pluginService.clonePlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    getPluginById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetPluginByIdInputDTO;
        const value = await this.pluginService.getPluginById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updatePluginById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdatePluginByIdInputDTO;
        const value = await this.pluginService.updatePluginById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeletePluginByIdInputDTO;
        await this.pluginService.deletePluginById(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    executePipeline = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        // `buildControllerParams` already injects `userId` from the authenticated
        // request, matching the former `withAuthenticatedUserId` extendParams.
        const input = buildControllerParams(req) as unknown as ExecutePipelineInputDTO;
        const value = await this.pluginService.executePipeline(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    // -- exposure ----------------------------------------------------------

    getPluginExposureGLB = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetPluginExposureGLBInputDTO;
        const output = await this.pluginService.getPluginExposureGLB(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    getPluginExposureChart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetPluginExposureChartInputDTO;
        const output = await this.pluginService.getPluginExposureChart(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    getPluginExposureExport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetPluginExposureExportInputDTO;
        const output = await this.pluginService.getPluginExposureExport(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    // -- listing-row -------------------------------------------------------

    getListingRowsByAnalysisId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetListingRowsByAnalysisIdInputDTO;
        const value = await this.pluginService.getListingRowsByAnalysisId(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getAnalysisListingExportOptions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetAnalysisListingExportOptionsInputDTO;
        const value = await this.pluginService.getAnalysisListingExportOptions(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    exportListingRowsByAnalysisId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ExportListingRowsByAnalysisIdInputDTO;
        const output = await this.pluginService.exportListingRowsByAnalysisId(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    getSubListing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetSubListingInputDTO;
        const value = await this.pluginService.getSubListing(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    exportPluginListingDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ExportPluginListingDocumentsInputDTO;
        const output = await this.pluginService.exportPluginListingDocuments(input);
        await output.prepare?.();
        this.pipeStream(res, output.stream, output.headers);
    };

    getPluginListingDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetPluginListingDocumentsInputDTO;
        const value = await this.pluginService.getPluginListingDocuments(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
