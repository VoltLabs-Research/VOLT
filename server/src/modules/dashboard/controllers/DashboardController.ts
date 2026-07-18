import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query, CurrentUser } from '@shared/http/params';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '@modules/team/middlewares/check-team-membership';
import DashboardService from '@modules/dashboard/services/DashboardService';
import { dashboardRoutes } from '@volt/contracts/modules/dashboard/routes';

@Middleware(protect, checkTeamMembership)
export default class DashboardController extends Controller {
    #service = new DashboardService();

    @Route(dashboardRoutes.getGlobalSearch)
    getGlobalSearch(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Query('query') query?: string,
        @Query('limit') limit?: string
    ) {
        return this.#service.getGlobalSearch({
            teamId,
            userId,
            query,
            limit: limit !== undefined ? Number(limit) : undefined
        });
    }
}
