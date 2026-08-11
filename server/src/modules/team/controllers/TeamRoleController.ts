import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import TeamRoleService from '@modules/team/services/TeamRoleService';
import { teamRoleRoutes } from '@volt/contracts/modules/team/routes';
import type { CreateTeamRoleInput, UpdateTeamRoleInput } from '@volt/contracts/modules/team/http';

@Middleware(protect, teamScoped(Resource.TEAM_ROLE))
export default class TeamRoleController extends Controller {
    #service = new TeamRoleService();

    @Route(teamRoleRoutes.list)
    listByTeamId(
        @Param('teamId') teamId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ){
        return this.#service.listByTeamId(teamId, page ? Number(page) : 1, limit ? Number(limit) : 10);
    }

    @Route(teamRoleRoutes.create)
    @Status(201)
    create(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<CreateTeamRoleInput>())) body: CreateTeamRoleInput
    ){
        return this.#service.create(teamId, userId, body);
    }

    @Route(teamRoleRoutes.remove)
    async deleteById(
        @Param('teamId') teamId: string,
        @Param('roleId') roleId: string,
        @CurrentUser() userId: string
    ){
        await this.#service.deleteById(teamId, roleId, userId);
    }

    @Route(teamRoleRoutes.get)
    getById(@Param('roleId') roleId: string) {
        return this.#service.getById(roleId);
    }

    @Route(teamRoleRoutes.update)
    updateById(
        @Param('roleId') roleId: string,
        @Body(schemaBody(typia.createValidate<UpdateTeamRoleInput>())) body: UpdateTeamRoleInput
    ){
        return this.#service.updateById(roleId, body);
    }
}
