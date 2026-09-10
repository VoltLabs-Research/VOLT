import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { checkTeamMembership } from '@modules/team/controllers/middleware/check-team-membership';
import { Resource } from '@core/constants/resources';
import teamService from '@modules/team/services/TeamService';
import { teamRoutes } from '@volt/contracts/modules/team/routes';
import type {
    CreateTeamInput,
    UpdateTeamInput,
    SetDefaultTeamInput
} from '@volt/contracts/modules/team/http';

@Middleware(protect)
export default class TeamController extends Controller {
    @Route(teamRoutes.previewJoinByCode)
    previewJoinByCode(
        @CurrentUser() userId: string,
        @Param('code') code: string
    ){
        return teamService.previewJoinByCode(userId, code);
    }

    @Route(teamRoutes.joinByCode)
    joinByCode(
        @CurrentUser() userId: string,
        @Param('code') code: string
    ){
        return teamService.joinByCode(userId, code);
    }

    @Route(teamRoutes.listUserTeams)
    listUserTeams(@CurrentUser() userId: string) {
        return teamService.listUserTeams(userId);
    }

    @Route(teamRoutes.create)
    @Status(201)
    create(
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<CreateTeamInput>())) body: CreateTeamInput
    ){
        return teamService.create(userId, body);
    }

    @Route(teamRoutes.getById)
    @Middleware(teamScoped(Resource.TEAM))
    getById(@Param('teamId') teamId: string) {
        return teamService.getById(teamId);
    }

    @Route(teamRoutes.updateById)
    @Middleware(teamScoped(Resource.TEAM))
    updateById(
        @Param('teamId') teamId: string,
        @Body(schemaBody(typia.createValidate<UpdateTeamInput>())) body: UpdateTeamInput
    ){
        return teamService.updateById(teamId, body);
    }

    @Route(teamRoutes.remove)
    @Middleware(teamScoped(Resource.TEAM))
    async deleteById(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string
    ){
        await teamService.deleteById(teamId, userId);
    }

    @Route(teamRoutes.setDefaultForNewUsers)
    @Middleware(teamScoped(Resource.TEAM))
    setDefaultForNewUsers(
        @Param('teamId') teamId: string,
        @Body(schemaBody(typia.createValidate<SetDefaultTeamInput>())) body: SetDefaultTeamInput
    ){
        return teamService.setDefaultForNewUsers(teamId, body.enabled);
    }

    @Route(teamRoutes.checkInvitePermission)
    @Middleware(teamScoped(Resource.TEAM))
    checkInvitePermission(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string
    ){
        return teamService.checkInvitePermission(teamId, userId);
    }

    @Route(teamRoutes.generateInviteCode)
    @Middleware(teamScoped(Resource.TEAM))
    generateInviteCode(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string
    ){
        return teamService.generateInviteCode(teamId, userId);
    }

    @Route(teamRoutes.deleteInviteCode)
    @Middleware(teamScoped(Resource.TEAM))
    deleteInviteCode(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string
    ){
        return teamService.deleteInviteCode(teamId, userId);
    }

    @Route(teamRoutes.getMyPermissions)
    @Middleware(checkTeamMembership)
    getMyPermissions(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string
    ){
        return teamService.getMyPermissions(teamId, userId);
    }

    @Route(teamRoutes.leave)
    @Middleware(checkTeamMembership)
    async leave(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string
    ){
        await teamService.leave(teamId, userId);
    }
}
