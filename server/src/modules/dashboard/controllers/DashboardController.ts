import type DashboardService from '@modules/dashboard/services/DashboardService';
import type { GetGlobalSearchInputDTO } from '@modules/dashboard/dtos/GetGlobalSearchDTO';
import { DASHBOARD_TOKENS } from '@modules/dashboard/di/DashboardTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the dashboard module. One Express handler per
 * route, assembling the service input exactly as `buildControllerParams` did
 * for the generated controllers, delegating to {@link DashboardService}, and
 * responding via {@link BaseResponse} with the original status codes.
 */
@injectable()
export default class DashboardController {
    constructor(
        @inject(DASHBOARD_TOKENS.DashboardService) private readonly dashboardService: DashboardService
    ) {}

    getGlobalSearch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetGlobalSearchInputDTO;
        const value = await this.dashboardService.getGlobalSearch(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
