import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { analysisRoutes } from '@volt/contracts/modules/analysis/routes';

@Middleware(protect, teamScoped(Resource.ANALYSIS))
export default class AnalysisController extends Controller {
    #service = new AnalysisService();

    @Route(analysisRoutes.listByTeamId)
    listByTeamId(
        @Param('teamId') teamId: string,
        @Query('trajectoryId') trajectoryId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string
    ) {
        const pageNumber = page !== undefined ? Number(page) : undefined;
        const pageLimit = limit !== undefined ? Number(limit) : undefined;
        if (trajectoryId !== undefined) {
            return this.#service.getAnalysesByTrajectoryId({
                teamId,
                trajectoryId,
                page: pageNumber,
                limit: pageLimit
            });
        }
        return this.#service.getAnalysesByTeamId({
            teamId,
            page: pageNumber,
            limit: pageLimit,
            search
        });
    }

    @Route(analysisRoutes.getFrameLog)
    getFrameLog(
        @Param('teamId') teamId: string,
        @Param('analysisId') analysisId: string,
        @Param('timestep') timestep: string,
        @Query('afterCursor') afterCursor?: string
    ) {
        return this.#service.getAnalysisFrameLog({
            teamId,
            analysisId,
            timestep: Number(timestep),
            afterCursor
        });
    }

    @Route(analysisRoutes.retryFailedFrames)
    retryFailedFrames(
        @Param('teamId') teamId: string,
        @Param('analysisId') analysisId: string,
        @CurrentUser() userId: string
    ) {
        return this.#service.retryFailedFrames({
            teamId,
            analysisId,
            userId
        });
    }

    @Route(analysisRoutes.getById)
    getById(
        @Param('teamId') teamId: string,
        @Param('analysisId') analysisId: string
    ){
        return this.#service.getAnalysisById({
            teamId,
            analysisId
        });
    }

    @Route(analysisRoutes.remove)
    @Status(204)
    async deleteById(
        @Param('teamId') teamId: string,
        @Param('analysisId') analysisId: string,
        @CurrentUser() userId: string
    ) {
        await this.#service.deleteAnalysisById({
            teamId,
            analysisId,
            userId
        });
    }
}
