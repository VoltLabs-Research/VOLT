import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import DailyActivityService from '@modules/daily-activity/services/DailyActivityService';
import { dailyActivityRoutes } from '@volt/contracts/modules/daily-activity/routes';

@Middleware(protect, teamScoped(Resource.DAILY_ACTIVITY))
export default class DailyActivityController extends Controller {
    #service = new DailyActivityService();

    @Route(dailyActivityRoutes.getTeamActivitySummary)
    async getTeamActivitySummary(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Query('range') range?: string,
        @Query('scope') scope?: string
    ) {
        const result = await this.#service.getTeamActivitySummary({
            teamId,
            range: range !== undefined ? Number(range) : undefined,
            userId: scope === 'self' ? userId : undefined
        });
        return result.records;
    }
}
