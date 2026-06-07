import { Resource } from '@core/constants/resources';
import type { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

export default createHttpModule({
    basePath: '/api/teams/:teamId/invitations',
    resource: Resource.TEAM_INVITATION,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.post('/', controllers.send.handle);
        router.get('/', async (req, res) => {
            const { teamId } = req.params as { teamId: string };
            const { page: pageRaw, limit: limitRaw } = req.query as {
                page?: string;
                limit?: string;
            };
            const page = pageRaw !== undefined ? Number(pageRaw) : 1;
            const limit = limitRaw !== undefined ? Number(limitRaw) : 10;
            const repository = container.resolve(TeamInvitationRepository);
            const result = await repository.findAll({
                filter: {
                    team: teamId,
                    status: TeamInvitationStatus.Pending
                } satisfies Partial<TeamInvitationProps>,
                populate: { path: 'invitedUser' },
                page,
                limit
            });

            BaseResponse.paginated(res, {
                ...result,
                data: result.data.map((invitation) => toPersistedOutput(invitation))
            });
        });
        router.delete('/:invitationId', controllers.deleteById.handle);
        router.patch('/:invitationId', controllers.updateById.handle);
        router.patch('/:invitationId/status', (req, res) => {
            const status = req.body?.status;
            if (status === 'accepted') {
                return controllers.accept.handle(req, res);
            }
            if (status === 'rejected') {
                return controllers.reject.handle(req, res);
            }
            return res.status(400).json({ message: 'Invalid status. Must be "accepted" or "rejected".' });
        });
    }
});
