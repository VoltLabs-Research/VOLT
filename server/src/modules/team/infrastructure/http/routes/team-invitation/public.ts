import { ErrorCodes } from '@core/constants/error-codes';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';
import { teamInvitationValidation } from '@modules/team/infrastructure/http/validation/team-invitation';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

export default createHttpModule({
    basePath: '/api/teams/invitations',
    protected: true,
    routes: (router) => {
        router.get('/:invitationId', teamInvitationValidation.getById, async (req, res) => {
            const { invitationId } = req.params as { invitationId: string };
            const repository = container.resolve(TeamInvitationRepository);
            const invitation = await repository.findById(invitationId, {
                populate: {
                    path: 'invitedBy team',
                    select: ['firstName', 'lastName', 'name', '_id']
                }
            });

            if (!invitation) {
                BaseResponse.error(
                    res,
                    'TeamInvitation not found',
                    HttpStatus.NotFound,
                    ErrorCodes.TEAM_INVITATION_NOT_FOUND
                );
                return;
            }

            BaseResponse.success(res, toPersistedOutput(invitation));
        });
        router.patch('/:invitationId/status', teamInvitationValidation.publicStatusById, (req, res) => {
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
