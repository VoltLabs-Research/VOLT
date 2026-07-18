import type DailyActivityService from '@modules/daily-activity/application/DailyActivityService';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the daily-activity module. One Express handler
 * per route, preserving the exact request parsing of the previously inline route
 * handler (team-scoped path param, `range` default of 7, `scope=self` narrowing
 * to the authenticated user), delegating to {@link DailyActivityService}, and
 * responding via {@link BaseResponse}. Handlers are arrow-function properties so
 * `this` stays bound when passed by reference to the router. Thrown
 * `ApplicationError`s propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding.
 */
@injectable()
export default class DailyActivityController {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityService) private readonly dailyActivityService: DailyActivityService
    ) {}

    getTeamActivitySummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { teamId } = req.params as { teamId: string };
        const { range: rangeRaw, scope } = req.query as { range?: string; scope?: 'team' | 'self' };
        const range = rangeRaw !== undefined ? Number(rangeRaw) : 7;
        const userId = scope === 'self'
            ? req.userId
            : undefined;

        const value = await this.dailyActivityService.getTeamActivitySummary({ teamId, range, userId });
        BaseResponse.success(res, value.records);
    };
}
