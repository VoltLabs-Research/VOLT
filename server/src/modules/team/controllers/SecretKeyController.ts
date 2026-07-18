import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Req } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import SecretKeyService from '@modules/team/services/SecretKeyService';
import { secretKeyRoutes } from '@volt/contracts/modules/team/routes';
import type { CreateSecretKeyInput } from '@volt/contracts/modules/team/http';

/**
 * HTTP controller for the secret-key resource. Class-level `@Middleware(protect)`
 * authenticates every route; the `/me` self route (formerly `secret-key/self`)
 * stays protect-only, while the team-scoped routes add
 * `teamScoped(Resource.TEAM_SECRET_KEY)`. `create` keeps 201, `deleteById` 204.
 */
@Middleware(protect)
export default class SecretKeyController extends Controller {
    #service = new SecretKeyService();

    @Route(secretKeyRoutes.current)
    current(@Req() req: AuthenticatedRequest) {
        return this.#service.current(req.authType, req.secretKeyId);
    }

    @Route(secretKeyRoutes.teamMetrics)
    @Middleware(teamScoped(Resource.TEAM_SECRET_KEY))
    teamMetrics(@Param('teamId') teamId: string, @Query('days') days?: string) {
        return this.#service.teamMetrics(teamId, days ? Number(days) : undefined);
    }

    @Route(secretKeyRoutes.keyUsage)
    @Middleware(teamScoped(Resource.TEAM_SECRET_KEY))
    keyUsage(@Param('teamId') teamId: string, @Param('secretKeyId') secretKeyId: string, @Query('days') days?: string) {
        return this.#service.keyUsage(teamId, secretKeyId, days ? Number(days) : undefined);
    }

    @Route(secretKeyRoutes.list)
    @Middleware(teamScoped(Resource.TEAM_SECRET_KEY))
    listByTeamId(@Param('teamId') teamId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
        return this.#service.listByTeamId(teamId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
    }

    @Route(secretKeyRoutes.create)
    @Status(201)
    @Middleware(teamScoped(Resource.TEAM_SECRET_KEY))
    create(@Param('teamId') teamId: string, @CurrentUser() userId: string, @Body() body: CreateSecretKeyInput) {
        return this.#service.create(teamId, userId, body);
    }

    @Route(secretKeyRoutes.revokeById)
    @Middleware(teamScoped(Resource.TEAM_SECRET_KEY))
    revokeById(@Param('teamId') teamId: string, @Param('secretKeyId') secretKeyId: string) {
        return this.#service.revokeById(teamId, secretKeyId);
    }

    @Route(secretKeyRoutes.deleteById)
    @Middleware(teamScoped(Resource.TEAM_SECRET_KEY))
    async deleteById(@Param('teamId') teamId: string, @Param('secretKeyId') secretKeyId: string, @CurrentUser() userId: string) {
        await this.#service.deleteById(teamId, secretKeyId, userId);
    }
}
