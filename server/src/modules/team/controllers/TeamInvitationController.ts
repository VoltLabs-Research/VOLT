import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import TeamInvitationService from '@modules/team/services/TeamInvitationService';
import { teamInvitationRoutes } from '@volt/contracts/modules/team/routes';
import type { SendTeamInvitationInput, UpdateTeamInvitationInput, TeamInvitationStatusInput } from '@volt/contracts/modules/team/http';

/**
 * HTTP controller for the team-invitation resource. Class-level `@Middleware(protect)`
 * authenticates every route; the team-scoped routes add `teamScoped(TEAM_INVITATION)`
 * per-method, while the two PUBLIC routes (`/api/teams/invitations/...`, formerly
 * `team-invitation/public`) stay protect-only. `updateStatus` reproduces the
 * former inline accepted/rejected dispatch; `send` keeps 201 and `deleteById` 204.
 */
@Middleware(protect)
export default class TeamInvitationController extends Controller {
    #service = new TeamInvitationService();

    @Route(teamInvitationRoutes.send)
    @Status(201)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    send(@Param('teamId') teamId: string, @CurrentUser() userId: string, @Body() body: SendTeamInvitationInput) {
        return this.#service.send(teamId, userId, body);
    }

    @Route(teamInvitationRoutes.list)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    listByTeamId(@Param('teamId') teamId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
        return this.#service.listByTeamId(teamId, page ? Number(page) : 1, limit ? Number(limit) : 10);
    }

    @Route(teamInvitationRoutes.remove)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    async deleteById(@Param('invitationId') invitationId: string) {
        await this.#service.deleteById(invitationId);
    }

    @Route(teamInvitationRoutes.update)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    updateById(@Param('invitationId') invitationId: string, @Body() body: UpdateTeamInvitationInput) {
        return this.#service.updateById(invitationId, body);
    }

    @Route(teamInvitationRoutes.updateStatus)
    @Middleware(teamScoped(Resource.TEAM_INVITATION))
    updateStatus(@Param('invitationId') invitationId: string, @CurrentUser() userId: string, @Body() body: TeamInvitationStatusInput) {
        return this.#dispatchStatus(invitationId, userId, body);
    }

    @Route(teamInvitationRoutes.getByIdPublic)
    getByIdPublic(@Param('invitationId') invitationId: string) {
        return this.#service.getByIdPublic(invitationId);
    }

    @Route(teamInvitationRoutes.updateStatusPublic)
    updateStatusPublic(@Param('invitationId') invitationId: string, @CurrentUser() userId: string, @Body() body: TeamInvitationStatusInput) {
        return this.#dispatchStatus(invitationId, userId, body);
    }

    #dispatchStatus(invitationId: string, userId: string, body: TeamInvitationStatusInput) {
        if (body?.status === 'accepted') {
            return this.#service.accept(invitationId, userId);
        }
        if (body?.status === 'rejected') {
            return this.#service.reject(invitationId, userId);
        }
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid status. Must be "accepted" or "rejected".');
    }
}
