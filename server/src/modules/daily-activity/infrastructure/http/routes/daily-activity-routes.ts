import { Resource } from '@core/constants/resources';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

export default createHttpModule({
    basePath: '/api/daily-activities/:teamId',
    resource: Resource.DAILY_ACTIVITY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', async (req, res) => {
            const { teamId } = req.params as { teamId: string };
            const { range: rangeRaw, scope } = req.query as { range?: string; scope?: 'team' | 'self' };
            const range = rangeRaw !== undefined ? Number(rangeRaw) : 7;
            const repository = container.resolve(DailyActivityRepository);
            const userId = scope === 'self'
                ? (req as AuthenticatedRequest).userId
                : undefined;

            BaseResponse.success(res, await repository.findActivityByTeamId(teamId, range, { userId }));
        });
    }
});
