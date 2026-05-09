import { ErrorCodes } from '@core/constants/error-codes';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team-member';
import { teamMemberValidation } from '@modules/team/infrastructure/http/validation/team-member';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

export default createHttpModule({
    basePath: '/api/teams/:teamId/members',
    resource: Resource.TEAM_MEMBER,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', teamMemberValidation.list, controllers.listByTeamId.handle);

        router.route('/:teamMemberId')
            .get(teamMemberValidation.getById, async (req, res) => {
                const { teamMemberId } = req.params as { teamMemberId: string };
                const repository = container.resolve(TeamMemberRepository);
                const member = await repository.findById(teamMemberId);

                if (!member) {
                    BaseResponse.error(
                        res,
                        'TeamMember not found',
                        HttpStatus.NotFound,
                        ErrorCodes.TEAM_MEMBER_NOT_FOUND
                    );
                    return;
                }

                BaseResponse.success(res, toPersistedOutput(member));
            })
            .patch(teamMemberValidation.update, controllers.updateById.handle);

        router.delete('/:memberId', teamMemberValidation.deleteById, controllers.deleteById.handle);
    }
});
