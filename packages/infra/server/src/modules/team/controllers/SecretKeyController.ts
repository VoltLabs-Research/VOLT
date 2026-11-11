import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentUser, CurrentTeamRole, Req } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import { TeamArea, type TeamRole } from '@volt/contracts/modules/team/access';
import secretKeyService from '@modules/team/services/SecretKeyService';
import { secretKeyRoutes } from '@volt/contracts/modules/team/routes';
import type { CreateSecretKeyInput } from '@volt/contracts/modules/team/http';

@Middleware(protect)
export default class SecretKeyController extends Controller {
    @Route(secretKeyRoutes.current)
    current(@Req() req: AuthenticatedRequest) {
        return secretKeyService.current(req.authType, req.secretKeyId);
    }

    @Route(secretKeyRoutes.teamMetrics)
    @Middleware(teamScoped(TeamArea.TeamSecretKey))
    teamMetrics(
        @Param('teamId') teamId: string,
        @Query('days') days?: string
    ){
        return secretKeyService.teamMetrics(teamId, days ? Number(days) : undefined);
    }

    @Route(secretKeyRoutes.keyUsage)
    @Middleware(teamScoped(TeamArea.TeamSecretKey))
    keyUsage(
        @Param('teamId') teamId: string,
        @Param('secretKeyId') secretKeyId: string,
        @Query('days') days?: string
    ){
        return secretKeyService.keyUsage(teamId, secretKeyId, days ? Number(days) : undefined);
    }

    @Route(secretKeyRoutes.list)
    @Middleware(teamScoped(TeamArea.TeamSecretKey))
    listByTeamId(
        @Param('teamId') teamId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ){
        return secretKeyService.listByTeamId(teamId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
    }

    @Route(secretKeyRoutes.create)
    @Status(201)
    @Middleware(teamScoped(TeamArea.TeamSecretKey))
    create(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @CurrentTeamRole() actorRole: TeamRole | undefined,
        @Body(schemaBody(typia.createValidate<CreateSecretKeyInput>())) body: CreateSecretKeyInput
    ){
        return secretKeyService.create(teamId, userId, actorRole, body);
    }

    @Route(secretKeyRoutes.revokeById)
    @Middleware(teamScoped(TeamArea.TeamSecretKey))
    revokeById(
        @Param('teamId') teamId: string,
        @Param('secretKeyId') secretKeyId: string
    ){
        return secretKeyService.revokeById(teamId, secretKeyId);
    }

    @Route(secretKeyRoutes.deleteById)
    @Middleware(teamScoped(TeamArea.TeamSecretKey))
    async deleteById(
        @Param('teamId') teamId: string,
        @Param('secretKeyId') secretKeyId: string,
        @CurrentUser() userId: string
    ){
        await secretKeyService.deleteById(teamId, secretKeyId, userId);
    }
}
