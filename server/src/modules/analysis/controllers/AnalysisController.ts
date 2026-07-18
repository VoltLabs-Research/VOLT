import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { analysisRoutes } from '@volt/contracts/modules/analysis/routes';

/**
 * The single HTTP controller for the analysis module (pollium style). Class-level
 * `@Middleware(protect, teamScoped(Resource.ANALYSIS))` replaces the old
 * mount-time auth + team-scope layer. List endpoints return a `PaginatedResult`
 * which the base `Controller` renders via `BaseResponse.paginated`; `remove`
 * returns void → 204 (preserving the former NoContent controller).
 */
@Middleware(protect, teamScoped(Resource.ANALYSIS))
export default class AnalysisController extends Controller {
    #service = new AnalysisService();

    @Route(analysisRoutes.listByTeamId)
    listByTeamId(
        @Param('teamId') teamId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string
    ) {
        return this.#service.getAnalysesByTeamId({
            teamId,
            page: page !== undefined ? Number(page) : undefined,
            limit: limit !== undefined ? Number(limit) : undefined,
            search
        });
    }

    @Route(analysisRoutes.listByTrajectoryId)
    listByTrajectoryId(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ) {
        return this.#service.getAnalysesByTrajectoryId({
            teamId,
            trajectoryId,
            page: page !== undefined ? Number(page) : undefined,
            limit: limit !== undefined ? Number(limit) : undefined
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
        return this.#service.retryFailedFrames({ teamId, analysisId, userId });
    }

    @Route(analysisRoutes.getById)
    getById(@Param('teamId') teamId: string, @Param('analysisId') analysisId: string) {
        return this.#service.getAnalysisById({ teamId, analysisId });
    }

    @Route(analysisRoutes.remove)
    @Status(204)
    async deleteById(
        @Param('teamId') teamId: string,
        @Param('analysisId') analysisId: string,
        @CurrentUser() userId: string
    ) {
        await this.#service.deleteAnalysisById({ teamId, analysisId, userId });
    }
}
