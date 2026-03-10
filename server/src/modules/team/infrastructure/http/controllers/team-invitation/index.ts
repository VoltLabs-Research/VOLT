import SendTeamInvitationController from './SendTeamInvitationController';
import DeleteTeamInvitationByIdController from './DeleteTeamInvitationByIdController';
import GetTeamInvitationByIdController from './GetTeamInvitationByIdController';
import GetPendingInvitationsController from './GetPendingInvitationsController';
import UpdateTeamInvitationByIdController from './UpdateTeamInvitationByIdController';
import AcceptTeamInvitationController from './AcceptTeamInvitationController';
import RejectTeamInvitationController from './RejectTeamInvitationController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    send: SendTeamInvitationController,
    deleteById: DeleteTeamInvitationByIdController,
    getById: GetTeamInvitationByIdController,
    listPendingByTeamId: GetPendingInvitationsController,
    updateById: UpdateTeamInvitationByIdController,
    accept: AcceptTeamInvitationController,
    reject: RejectTeamInvitationController
});