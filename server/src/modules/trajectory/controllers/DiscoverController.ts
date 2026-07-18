import { Route } from '@shared/http/route';
import { Req, Res } from '@shared/http/params';
import TrajectoryControllerBase from '@modules/trajectory/controllers/TrajectoryControllerBase';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

/**
 * Public discover HTTP controller (pollium style). Mirrors the old
 * `/api/discover/teams` module: `protected: false`, no team scope — a fully
 * public listing of a team's public trajectories, so this controller declares
 * NO class-level `@Middleware`.
 */
export default class DiscoverController extends TrajectoryControllerBase {
    @Route(trajectoryRoutes.discoverListPublicTrajectories)
    async discoverListPublicTeamTrajectories(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
        this.sendPaginated(res, await this.service.listPublicTeamTrajectories(this.params(req)));
    }
}
