import { ErrorCodes } from '@core/constants/error-codes';
import { Resource } from '@core/constants/resources';
import type { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import controllers from '@modules/team/infrastructure/http/controllers/team-role';
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
            .get(async (req, res) => {
                const { teamId } = req.params as { teamId: string };
                const { page: pageRaw, limit: limitRaw } = req.query as {
                    page?: string;
                    limit?: string;
                };
                const page = pageRaw !== undefined ? Number(pageRaw) : 1;
                const limit = limitRaw !== undefined ? Number(limitRaw) : 10;
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
            .post(controllers.create.handle);

        router.route('/:roleId')
            .delete(controllers.deleteById.handle)
            .get(async (req, res) => {
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
            .patch(controllers.updateById.handle);
    }
});
