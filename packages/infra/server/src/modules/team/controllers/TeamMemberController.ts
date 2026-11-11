import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentTeamRole } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { TeamArea, type TeamRole } from '@volt/contracts/modules/team/access';
import teamMemberService from '@modules/team/services/TeamMemberService';
import { teamMemberRoutes } from '@volt/contracts/modules/team/routes';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';

@Middleware(protect, teamScoped(TeamArea.TeamMember))
export default class TeamMemberController extends Controller {
    @Route(teamMemberRoutes.list)
    listByTeamId(
        @Param('teamId') teamId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ){
        return teamMemberService.listByTeamId(teamId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
    }

    @Route(teamMemberRoutes.get)
    getById(
        @Param('teamId') teamId: string,
        @Param('teamMemberId') teamMemberId: string
    ){
        return teamMemberService.getById(teamId, teamMemberId);
    }

    @Route(teamMemberRoutes.update)
    updateById(
        @Param('teamId') teamId: string,
        @Param('teamMemberId') teamMemberId: string,
        @CurrentTeamRole() actorRole: TeamRole | undefined,
        @Body(schemaBody(typia.createValidate<UpdateTeamMemberInput>())) body: UpdateTeamMemberInput
    ){
        return teamMemberService.updateById(teamId, teamMemberId, actorRole, body);
    }

    @Route(teamMemberRoutes.remove)
    async deleteById(
        @Param('teamId') teamId: string,
        @Param('memberId') memberId: string,
        @CurrentTeamRole() actorRole: TeamRole | undefined
    ){
        await teamMemberService.deleteById(teamId, memberId, actorRole);
    }
}
