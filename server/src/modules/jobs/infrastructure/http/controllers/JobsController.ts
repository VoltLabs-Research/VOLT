import type JobsService from '@modules/jobs/application/JobsService';
import type { RemoveTeamRunningJobsInputDTO } from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';
import type { RetryTeamFailedJobsInputDTO } from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the jobs module. One Express handler per route,
 * assembling the use-case input via the shared `buildControllerParams`,
 * delegating to {@link JobsService}, and responding via {@link BaseResponse}.
 * Handlers are arrow-function properties so `this` stays bound when passed by
 * reference to the router. Thrown `ApplicationError`s propagate to
 * `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class JobsController {
    constructor(
        @inject(JOBS_TOKENS.JobsService) private readonly jobsService: JobsService
    ) {}

    removeRunningJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as RemoveTeamRunningJobsInputDTO;
        const value = await this.jobsService.removeRunningJobs(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    retryFailedJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as RetryTeamFailedJobsInputDTO;
        const value = await this.jobsService.retryFailedJobs(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
