import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import teamInvitationService from '@modules/team/services/TeamInvitationService';
import { teamInvitationRoutes } from '@volt/contracts/modules/team/routes';
import type { SendTeamInvitationInput, UpdateTeamInvitationInput, TeamInvitationStatusInput } from '@volt/contracts/modules/team/http';

@Middleware(protect)
export default class TeamInvitationController extends Controller {
    @Route(teamInvitationRoutes.send)
    @Status(201)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    send(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<SendTeamInvitationInput>())) body: SendTeamInvitationInput
    ){
        return teamInvitationService.send(teamId, userId, body);
    }

    @Route(teamInvitationRoutes.list)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    listByTeamId(
        @Param('teamId') teamId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ){
        return teamInvitationService.listByTeamId(teamId, page ? Number(page) : 1, limit ? Number(limit) : 10);
    }

    @Route(teamInvitationRoutes.remove)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    async deleteById(
        @Param('teamId') teamId: string,
        @Param('invitationId') invitationId: string
    ){
        await teamInvitationService.deleteById(teamId, invitationId);
    }

    @Route(teamInvitationRoutes.update)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    updateById(
        @Param('teamId') teamId: string,
        @Param('invitationId') invitationId: string,
        @Body(schemaBody(typia.createValidate<UpdateTeamInvitationInput>())) body: UpdateTeamInvitationInput
    ){
        return teamInvitationService.updateById(teamId, invitationId, body);
    }

    @Route(teamInvitationRoutes.updateStatus)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    updateStatus(
        @Param('teamId') teamId: string,
        @Param('invitationId') invitationId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<TeamInvitationStatusInput>())) body: TeamInvitationStatusInput
    ) {
        return teamInvitationService.updateStatus(invitationId, userId, body, teamId);
    }

    @Route(teamInvitationRoutes.getByIdPublic)
    getByIdPublic(@Param('invitationId') invitationId: string) {
        return teamInvitationService.getByIdPublic(invitationId);
    }

    @Route(teamInvitationRoutes.updateStatusPublic)
    updateStatusPublic(
        @Param('invitationId') invitationId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<TeamInvitationStatusInput>())) body: TeamInvitationStatusInput
    ){
        return teamInvitationService.updateStatus(invitationId, userId, body);
    }
}
