import { createController } from '@shared/infrastructure/http/controllers/createController';
import RejectTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/RejectTeamInvitationUseCase';

const RejectTeamInvitationController = createController(RejectTeamInvitationUseCase);
export default RejectTeamInvitationController;
