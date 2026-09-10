import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Body, CurrentUser, Param, Req, Res, schemaBody } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import pluginCrudService from '@modules/plugin/services/plugin/PluginCrudService';
import pluginArchiveService, { type RegistryInstallPluginInput } from '@modules/plugin/services/plugin/PluginArchiveService';
import pluginBinaryStorageService from '@modules/plugin/services/plugin/PluginBinaryStorageService';
import pipelineExecutionPlanner, { type ExecutePipelineInput } from '@modules/plugin/services/plugin/PipelineExecutionPlanner';
import registryGateway, { type SearchRegistryPluginsInput } from '@modules/plugin/services/plugin/RegistryGateway';
import workflowValidatorService, { type ValidateWorkflowInput } from '@modules/plugin/services/plugin/WorkflowValidatorService';
import pluginExposureArtifactService from '@modules/plugin/services/exposure/PluginExposureArtifactService';
import pluginListingQueryService from '@modules/plugin/services/listing-row/PluginListingQueryService';
import analysisListingExportCatalogService from '@modules/plugin/services/listing-row/AnalysisListingExportCatalogService';
import listingRowsExportService from '@modules/plugin/services/listing-row/ListingRowsExportService';
import { getPipelineRunsByTrajectoryId } from '@modules/plugin/services/plugin/PipelineRunQueries';
import { deletePipelineRun, updatePipelineRun } from '@modules/plugin/services/plugin/PipelineRunCommands';
import { NODE_OUTPUT_PROPERTIES } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import type { ListPluginsInput, UpdatePluginByIdInput } from '@modules/plugin/services/plugin/PluginCrudService';
import type { DeletePipelineRunInput } from '@modules/plugin/services/plugin/PipelineRunCommands';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';

import { ErrorCodes } from '@core/constants/error-codes';
import { buildControllerParams, readAcceptEncoding } from '@shared/http/controllers/controller-internals';
import { HttpStatus } from '@shared/http/constants/HttpStatus';
import BaseResponse from '@shared/http/responses/BaseResponse';
import multer from 'multer';

import type { GetPipelineRunsByTrajectoryIdInput } from '@modules/plugin/services/plugin/PipelineRunQueries';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import type {
    CommitBinaryUploadInput as WireCommitBinaryUploadInput,
    UploadBinaryInput as WireUploadBinaryInput
} from '@volt/contracts/modules/plugin/http';
import type { UpdatePipelineRunInput } from '@volt/contracts/modules/plugin/http';
import type { GetPluginExposureExportInput } from '@shared/contracts/operations/GetPluginExposureExport';
import type { GetPluginExposurePanelsInput } from '@modules/plugin/services/exposure/PluginExposureArtifactService';
import type { GetPluginExposureGLBInput } from '@shared/contracts/operations/GetPluginExposureGLB';
import type {
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
import { pipeStreamToResponse } from '@shared/http/responses/pipe-stream';
import type { GetPluginExposureChartInput } from '@modules/plugin/services/exposure/PluginExposureArtifactService';

interface PluginIdInput {
    pluginId: string;
}

interface ClonePluginInput extends PluginIdInput {
    teamId: string;
}

interface CreatePluginInput {
    workflow: WorkflowProps;
    teamId: string;
}

interface DownloadPluginBinaryInput extends PluginIdInput {
    teamId: string;
}

interface ImportPluginInput {
    file: { buffer: Buffer };
    teamId: string;
}

interface UploadBinaryInput extends WireUploadBinaryInput, PluginIdInput {
    teamId: string;
    userId: string;
}

interface CommitBinaryUploadInput extends WireCommitBinaryUploadInput, PluginIdInput {
    teamId: string;
    userId: string;
}

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

    @Route(pluginRoutes.getListingRowsByAnalysisId)
    async getListingRowsByAnalysisId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetListingRowsByAnalysisIdInput;
        const value = await pluginListingQueryService.getListingRowsByAnalysisId(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportListingRowsByAnalysisId)
    async exportListingRowsByAnalysisId(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ExportListingRowsByAnalysisIdInput;
        const output = await listingRowsExportService.present(
            await analysisListingExportCatalogService.buildExportPayload(input)
        );
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getSubListing)
    async getSubListing(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetSubListingInput;
        const value = await pluginListingQueryService.getSubListing(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportPluginListingDocuments)
    async exportPluginListingDocuments(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ExportPluginListingDocumentsInput;
        const output = await pluginListingQueryService.exportPluginListingDocuments(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginListingDocuments)
    async getPluginListingDocuments(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginListingDocumentsInput;
        const value = await pluginListingQueryService.getPluginListingDocuments(input);
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
        const output = await pluginExposureArtifactService.getExposureGLB(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginExposurePanels)
    async getPluginExposurePanels(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginExposurePanelsInput;
        const value = await pluginExposureArtifactService.getExposurePanels({
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
        const output = await pluginExposureArtifactService.getExposureChart(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getPluginExposureExport)
    async getPluginExposureExport(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPluginExposureExportInput;
        const output = await pluginExposureArtifactService.getExposureExport(input);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.getNodeTypesSchema)
    async getNodeTypesSchema(@Res() res: Response): Promise<void> {
        const value = { nodeTypes: NODE_OUTPUT_PROPERTIES };
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.validateWorkflow)
    async validateWorkflow(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ValidateWorkflowInput;
        const value = await workflowValidatorService.validateWorkflow(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.exportPlugin)
    async exportPlugin(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as PluginIdInput;
        const output = await pluginArchiveService.exportPlugin(input.pluginId);
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
        const value = await pluginArchiveService.importPlugin(input.file.buffer, input.teamId);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.searchRegistry)
    async searchRegistry(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as SearchRegistryPluginsInput;
        const value = await registryGateway.search(input.q, input.page, input.limit);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.installRegistry)
    async installRegistry(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as RegistryInstallPluginInput;
        const value = await pluginArchiveService.installFromRegistry(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.list)
    async listPlugins(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ListPluginsInput;
        const value = await pluginCrudService.listPlugins(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.create)
    async create(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as CreatePluginInput;
        const value = await pluginCrudService.createPlugin(input.workflow, input.teamId);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.commitBinaryUpload)
    async commitBinaryUpload(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as CommitBinaryUploadInput;
        const value = await pluginBinaryStorageService.commitUpload(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.downloadBinary)
    async downloadBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as DownloadPluginBinaryInput;
        const output = await pluginBinaryStorageService.downloadBinary(input.pluginId, input.teamId);
        await output.prepare?.();
        await pipeStreamToResponse(res, output.stream, output.headers);
    }

    @Route(pluginRoutes.uploadBinary)
    async uploadBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as UploadBinaryInput;
        const value = await pluginBinaryStorageService.createUploadTarget(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.removeBinary)
    async deleteBinary(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as PluginIdInput;
        await pluginBinaryStorageService.deleteBinary(input.pluginId);

        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.clone)
    async clone(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as ClonePluginInput;
        const value = await pluginCrudService.clonePlugin(input.pluginId, input.teamId);
        BaseResponse.success(res, value, HttpStatus.Created);
    }

    @Route(pluginRoutes.get)
    async getPluginById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as PluginIdInput;
        const value = await pluginCrudService.getPluginById(input.pluginId);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.update)
    async updatePluginById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as UpdatePluginByIdInput;
        const value = await pluginCrudService.updatePluginById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.remove)
    async deleteById(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as PluginIdInput;
        await pluginCrudService.deletePluginById(input.pluginId);

        res.status(HttpStatus.NoContent).send();
    }

    @Route(pluginRoutes.listPipelineRuns)
    async listPipelineRuns(
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void>{
        const input = buildControllerParams(req) as unknown as GetPipelineRunsByTrajectoryIdInput;
        const value = await getPipelineRunsByTrajectoryId(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }

    @Route(pluginRoutes.updatePipelineRun)
    async updatePipelineRun(
        @Param('teamId') teamId: string,
        @Param('pipelineRunId') pipelineRunId: string,
        @Body(schemaBody(typia.createValidate<UpdatePipelineRunInput>())) body: UpdatePipelineRunInput,
        @Res() res: Response
    ): Promise<void>{
        const value = await updatePipelineRun({
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
        await deletePipelineRun({
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
        const value = await pipelineExecutionPlanner.executePipeline(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    }
}
