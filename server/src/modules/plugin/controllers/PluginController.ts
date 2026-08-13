import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Body, CurrentUser, Param, Req, Res, schemaBody } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import PluginService from '@modules/plugin/services/PluginService';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';

import { ErrorCodes } from '@core/constants/error-codes';
import { buildControllerParams, readAcceptEncoding } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import multer from 'multer';

import type {
    ClonePluginInput,
    CreatePluginInput,
    DownloadPluginBinaryInput,
    ExecutePipelineInput,
    ImportPluginInput,
    ListPluginsInput,
    PluginIdInput,
    RegistryInstallPluginInput,
    SearchRegistryPluginsInput,
    UpdatePluginByIdInput,
    CommitBinaryUploadInput,
    UploadBinaryInput,
    ValidateWorkflowInput,
    GetPluginExposureChartInput
} from '@modules/plugin/services/PluginService';
import type { GetPipelineRunsByTrajectoryIdInput } from '@modules/plugin/services/plugin/PipelineRunQueries';
import type { UpdatePipelineRunInput } from '@volt/contracts/modules/plugin/http';
import type { GetPluginByIdInput } from '@shared/contracts/operations/GetPluginById';
import type { GetPluginExposureExportInput } from '@shared/contracts/operations/GetPluginExposureExport';
import type { GetPluginExposurePanelsInput } from '@modules/plugin/services/exposure/PluginExposureArtifactService';
import type { GetPluginExposureGLBInput } from '@shared/contracts/operations/GetPluginExposureGLB';
import type {
    GetAnalysisListingExportOptionsInput,
    ExportListingRowsByAnalysisIdInput,
    GetListingRowsByAnalysisIdInput
} from '@modules/plugin/services/listing-row/ListingRowTypes';
import type {
    ExportPluginListingDocumentsInput,
    GetPluginListingDocumentsInput
} from '@shared/contracts/operations/GetPluginListingDocuments';
import type { GetSubListingInput } from '@shared/contracts/operations/GetSubListing';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { NextFunction, Request, Response } from 'express';
import { pipeStreamToResponse } from '@shared/infrastructure/http/responses/pipe-stream';

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


    @Route(pluginRoutes.getListingRowsByAnalysisId)
    async getListingRowsByAnalysisId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetListingRowsByAnalysisIdInput;
        const value = await this.#service.getListingRowsByAnalysisId(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.getAnalysisListingExportOptions)
    async getAnalysisListingExportOptions(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetAnalysisListingExportOptionsInput;
        const value = await this.#service.getAnalysisListingExportOptions(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportListingRowsByAnalysisId)
    async exportListingRowsByAnalysisId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ExportListingRowsByAnalysisIdInput;
        const output = await this.#service.exportListingRowsByAnalysisId(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getSubListing)
    async getSubListing(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetSubListingInput;
        const value = await this.#service.getSubListing(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportPluginListingDocuments)
    async exportPluginListingDocuments(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ExportPluginListingDocumentsInput;
        const output = await this.#service.exportPluginListingDocuments(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginListingDocuments)
    async getPluginListingDocuments(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginListingDocumentsInput;
        const value = await this.#service.getPluginListingDocuments(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.getPluginExposureGLB)
    async getPluginExposureGLB(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = {
            ...buildControllerParams(req) as unknown as GetPluginExposureGLBInput,
            acceptEncoding: readAcceptEncoding(req)
        };
        const output = await this.#service.getPluginExposureGLB(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginExposurePanels)
    async getPluginExposurePanels(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginExposurePanelsInput;
        const value = await this.#service.getPluginExposurePanels({
            ...input,
            timestep: Number(input.timestep)
        });
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.getPluginExposureChart)
    async getPluginExposureChart(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginExposureChartInput;
        const output = await this.#service.getPluginExposureChart(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginExposureExport)
    async getPluginExposureExport(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginExposureExportInput;
        const output = await this.#service.getPluginExposureExport(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getNodeTypesSchema)
    async getNodeTypesSchema(@Res() res: Response): Promise<void> {
        const value = await this.#service.getNodeTypesSchema();
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.validateWorkflow)
    async validateWorkflow(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ValidateWorkflowInput;
        const value = await this.#service.validateWorkflow(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportPlugin)
    async exportPlugin(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as PluginIdInput;
        const output = await this.#service.exportPlugin(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.importPlugin)
    @Middleware(importUploadSingleFile('file'))
    async importPlugin(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ImportPluginInput;
        const value = await this.#service.importPlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.searchRegistry)
    async searchRegistry(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as SearchRegistryPluginsInput;
        const value = await this.#service.searchRegistry(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.installRegistry)
    async installRegistry(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as RegistryInstallPluginInput;
        const value = await this.#service.installRegistry(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.list)
    async listPlugins(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ListPluginsInput;
        const value = await this.#service.listPlugins(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.create)
    async create(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as CreatePluginInput;
        const value = await this.#service.createPlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.commitBinaryUpload)
    async commitBinaryUpload(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as CommitBinaryUploadInput;
        const value = await this.#service.commitBinaryUpload(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.downloadBinary)
    async downloadBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as DownloadPluginBinaryInput;
        const output = await this.#service.downloadBinary(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.uploadBinary)
    async uploadBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as UploadBinaryInput;
        const value = await this.#service.uploadBinary(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.removeBinary)
    async deleteBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as PluginIdInput;
        await this.#service.deleteBinary(input);

        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.clone)
    async clone(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ClonePluginInput;
        const value = await this.#service.clonePlugin(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.get)
    async getPluginById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginByIdInput;
        const value = await this.#service.getPluginById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.update)
    async updatePluginById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as UpdatePluginByIdInput;
        const value = await this.#service.updatePluginById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.remove)
    async deleteById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as PluginIdInput;
        await this.#service.deletePluginById(input);

        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.listPipelineRuns)
    async listPipelineRuns(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPipelineRunsByTrajectoryIdInput;
        const value = await this.#service.getPipelineRunsByTrajectoryId(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    /*
     * Validated body rather than the module's usual `buildControllerParams` cast:
     * this is the one plugin endpoint whose payload is free text typed by a user.
     */
    @Route(pluginRoutes.updatePipelineRun)
    async updatePipelineRun(
        @Param('teamId') teamId: string,
        @Param('pipelineRunId') pipelineRunId: string,
        @Body(schemaBody(typia.createValidate<UpdatePipelineRunInput>())) body: UpdatePipelineRunInput,
        @Res() res: Response
    ): Promise<void>{
        const value = await this.#service.updatePipelineRun({
            teamId,
            pipelineRunId,
            name: body.name
        });
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.deletePipelineRun)
    async deletePipelineRun(
        @Param('teamId') teamId: string,
        @Param('pipelineRunId') pipelineRunId: string,
        @CurrentUser() userId: string,
        @Res() res: Response
    ): Promise<void>{
        await this.#service.deletePipelineRun({
            teamId,
            pipelineRunId,
            userId
        });

        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.executePipeline)
    async executePipeline(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ExecutePipelineInput;
        const value = await this.#service.executePipeline(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
