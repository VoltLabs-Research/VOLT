import SendTeamInvitationController from './SendTeamInvitationController';
import DeleteTeamInvitationByIdController from './DeleteTeamInvitationByIdController';
import GetTeamInvitationByIdController from './GetTeamInvitationByIdController';
import GetPendingInvitationsController from './GetPendingInvitationsController';
import UpdateTeamInvitationByIdController from './UpdateTeamInvitationByIdController';
import { container } from 'tsyringe';

export default {
    send: container.resolve(SendTeamInvitationController),
    deleteById: container.resolve(DeleteTeamInvitationByIdController),
    getById: container.resolve(GetTeamInvitationByIdController),
    listPendingByTeamId: container.resolve(GetPendingInvitationsController),
    updateById: container.resolve(UpdateTeamInvitationByIdController)
};