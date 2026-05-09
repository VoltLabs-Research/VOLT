import { ErrorCodes } from '@core/constants/error-codes';
import { Resource } from '@core/constants/resources';
import type { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import controllers from '@modules/team/infrastructure/http/controllers/team-role';
import { teamRoleValidation } from '@modules/team/infrastructure/http/validation/team-role';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

export default createHttpModule({
    basePath: '/api/teams/:teamId/roles',
    resource: Resource.TEAM_ROLE,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.route('/')
            .get(teamRoleValidation.list, async (req, res) => {
                const { teamId } = req.params as { teamId: string };
                const { page = 1, limit = 10 } = req.query as unknown as {
                    page?: number;
                    limit?: number;
                };
                const repository = container.resolve(TeamRoleRepository);
                const result = await repository.findAll({
                    filter: { team: teamId } satisfies Partial<TeamRoleProps>,
                    page,
                    limit
                });

                BaseResponse.paginated(res, {
                    ...result,
                    data: result.data.map((role) => toPersistedOutput(role))
                });
            })
            .post(teamRoleValidation.create, controllers.create.handle);

        router.route('/:roleId')
            .delete(teamRoleValidation.deleteById, controllers.deleteById.handle)
            .get(teamRoleValidation.getById, async (req, res) => {
                const { roleId } = req.params as { roleId: string };
                const repository = container.resolve(TeamRoleRepository);
                const role = await repository.findById(roleId);

                if (!role) {
                    BaseResponse.error(
                        res,
                        'TeamRole not found',
                        HttpStatus.NotFound,
                        ErrorCodes.TEAM_ROLE_NOT_FOUND
                    );
                    return;
                }

                BaseResponse.success(res, toPersistedOutput(role));
            })
            .patch(teamRoleValidation.update, controllers.updateById.handle);
    }
});
