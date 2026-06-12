import { Resource } from '@core/constants/resources';
import GetTeamActivitySummaryUseCase from '@modules/daily-activity/application/use-cases/GetTeamActivitySummaryUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

export default createHttpModule({
    moduleKey: 'daily-activity',
    basePath: '/api/daily-activities/:teamId',
    resource: Resource.DAILY_ACTIVITY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', async (req, res) => {
            const { teamId } = req.params as { teamId: string };
            const { range: rangeRaw, scope } = req.query as { range?: string; scope?: 'team' | 'self' };
            const range = rangeRaw !== undefined ? Number(rangeRaw) : 7;
            const userId = scope === 'self'
                ? (req as AuthenticatedRequest).userId
                : undefined;

            const useCase = container.resolve(GetTeamActivitySummaryUseCase);
            const result = await useCase.execute({ teamId, range, userId });
            if (!result.success) {
                throw result.error;
            }

            BaseResponse.success(res, result.value.records);
        });
    }
});
