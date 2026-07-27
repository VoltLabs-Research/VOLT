import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Body, Param, Query } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import TeamMemberService from '@modules/team/services/TeamMemberService';
import { teamMemberRoutes } from '@volt/contracts/modules/team/routes';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';

@Middleware(protect, teamScoped(Resource.TEAM_MEMBER))
export default class TeamMemberController extends Controller {
    #service = new TeamMemberService();

    @Route(teamMemberRoutes.list)
    listByTeamId(@Param('teamId') teamId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
        return this.#service.listByTeamId(teamId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
    }

    @Route(teamMemberRoutes.get)
    getById(@Param('teamMemberId') teamMemberId: string) {
        return this.#service.getById(teamMemberId);
    }

    @Route(teamMemberRoutes.update)
    updateById(@Param('teamMemberId') teamMemberId: string, @Body() body: UpdateTeamMemberInput) {
        return this.#service.updateById(teamMemberId, body);
    }

    @Route(teamMemberRoutes.remove)
    async deleteById(@Param('teamId') teamId: string, @Param('memberId') memberId: string) {
        await this.#service.deleteById(teamId, memberId);
    }
}
