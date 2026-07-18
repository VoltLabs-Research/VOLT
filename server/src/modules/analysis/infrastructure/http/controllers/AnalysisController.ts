import type AnalysisService from '@modules/analysis/application/AnalysisService';
import type { DeleteAnalysisByIdInputDTO } from '@modules/analysis/application/dtos/DeleteAnalysisByIdDTO';
import type { GetAnalysesByTeamIdInputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import type { GetAnalysesByTrajectoryIdInputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import type { GetAnalysisByIdInputDTO } from '@modules/analysis/application/dtos/GetAnalysisByIdDTO';
import type { GetAnalysisFrameLogInputDTO } from '@modules/analysis/application/dtos/GetAnalysisFrameLogDTO';
import type { RetryFailedFramesInputDTO } from '@modules/analysis/application/dtos/RetryFailedFramesDTO';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the analysis module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did
 * for the generated controllers, delegating to {@link AnalysisService}, and
 * responding via {@link BaseResponse}. The list handlers reproduce the former
 * `createPaginatedController` behaviour (`BaseResponse.paginated` with the
 * result's `_meta`), and `deleteById` preserves the former NoContent controller
 * (empty body). Handlers are arrow-function properties so `this` stays bound
 * when passed by reference to the router. Thrown `ApplicationError`s propagate
 * to `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class AnalysisController {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisService) private readonly analysisService: AnalysisService
    ) {}

    listByTeamId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetAnalysesByTeamIdInputDTO;
        const value = await this.analysisService.getAnalysesByTeamId(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    listByTrajectoryId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetAnalysesByTrajectoryIdInputDTO;
        const value = await this.analysisService.getAnalysesByTrajectoryId(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    getFrameLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetAnalysisFrameLogInputDTO;
        const value = await this.analysisService.getAnalysisFrameLog(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    retryFailedFrames = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as RetryFailedFramesInputDTO;
        const value = await this.analysisService.retryFailedFrames(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetAnalysisByIdInputDTO;
        const value = await this.analysisService.getAnalysisById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteAnalysisByIdInputDTO;
        await this.analysisService.deleteAnalysisById(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };
}
