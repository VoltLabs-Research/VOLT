import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import { checkTeamMembership } from '@modules/team/controllers/middleware/check-team-membership';
import { Resource } from '@core/constants/resources';
import TeamService from '@modules/team/services/TeamService';
import { teamRoutes } from '@volt/contracts/modules/team/routes';
import type { RequestHandler, Response, NextFunction } from 'express';
import type {
    CreateTeamInput,
    UpdateTeamInput,
    JoinTeamByCodeInput,
    SetDefaultTeamInput
} from '@volt/contracts/modules/team/http';

const teamMembership: RequestHandler = (req, res: Response, next: NextFunction): void => {
    void checkTeamMembership(req as AuthenticatedRequest, res, next);
};

@Middleware(protect)
export default class TeamController extends Controller {
    #service = new TeamService();

    @Route(teamRoutes.previewJoinByCode)
    previewJoinByCode(@CurrentUser() userId: string, @Body() body: JoinTeamByCodeInput) {
        return this.#service.previewJoinByCode(userId, body.code);
    }

    @Route(teamRoutes.joinByCode)
    joinByCode(@CurrentUser() userId: string, @Body() body: JoinTeamByCodeInput) {
        return this.#service.joinByCode(userId, body.code);
    }

    @Route(teamRoutes.listUserTeams)
    listUserTeams(@CurrentUser() userId: string) {
        return this.#service.listUserTeams(userId);
    }

    @Route(teamRoutes.create)
    @Status(201)
    create(@CurrentUser() userId: string, @Body() body: CreateTeamInput) {
        return this.#service.create(userId, body);
    }

    @Route(teamRoutes.getById)
    @Middleware(teamScoped(Resource.TEAM))
    getById(@Param('teamId') teamId: string) {
        return this.#service.getById(teamId);
    }

    @Route(teamRoutes.updateById)
    @Middleware(teamScoped(Resource.TEAM))
    updateById(@Param('teamId') teamId: string, @Body() body: UpdateTeamInput) {
        return this.#service.updateById(teamId, body);
    }

    @Route(teamRoutes.remove)
    @Middleware(teamScoped(Resource.TEAM))
    async deleteById(@Param('teamId') teamId: string, @CurrentUser() userId: string) {
        await this.#service.deleteById(teamId, userId);
    }

    @Route(teamRoutes.setDefaultForNewUsers)
    @Middleware(teamScoped(Resource.TEAM))
    setDefaultForNewUsers(@Param('teamId') teamId: string, @Body() body: SetDefaultTeamInput) {
        return this.#service.setDefaultForNewUsers(teamId, body.enabled);
    }

    @Route(teamRoutes.checkInvitePermission)
    @Middleware(teamScoped(Resource.TEAM))
    checkInvitePermission(@Param('teamId') teamId: string, @CurrentUser() userId: string) {
        return this.#service.checkInvitePermission(teamId, userId);
    }

    @Route(teamRoutes.generateInviteCode)
    @Middleware(teamScoped(Resource.TEAM))
    generateInviteCode(@Param('teamId') teamId: string, @CurrentUser() userId: string) {
        return this.#service.generateInviteCode(teamId, userId);
    }

    @Route(teamRoutes.deleteInviteCode)
    @Middleware(teamScoped(Resource.TEAM))
    deleteInviteCode(@Param('teamId') teamId: string, @CurrentUser() userId: string) {
        return this.#service.deleteInviteCode(teamId, userId);
    }

    @Route(teamRoutes.getMyPermissions)
    @Middleware(teamMembership)
    getMyPermissions(@Param('teamId') teamId: string, @CurrentUser() userId: string) {
        return this.#service.getMyPermissions(teamId, userId);
    }

    @Route(teamRoutes.leave)
    @Middleware(teamMembership)
    async leave(@Param('teamId') teamId: string, @CurrentUser() userId: string) {
        await this.#service.leave(teamId, userId);
    }
}
