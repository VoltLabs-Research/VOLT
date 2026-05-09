import SendTeamInvitationController from './SendTeamInvitationController';
import DeleteTeamInvitationByIdController from './DeleteTeamInvitationByIdController';
import UpdateTeamInvitationByIdController from './UpdateTeamInvitationByIdController';
import AcceptTeamInvitationController from './AcceptTeamInvitationController';
import RejectTeamInvitationController from './RejectTeamInvitationController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    send: SendTeamInvitationController,
    deleteById: DeleteTeamInvitationByIdController,
    updateById: UpdateTeamInvitationByIdController,
    accept: AcceptTeamInvitationController,
    reject: RejectTeamInvitationController
});
