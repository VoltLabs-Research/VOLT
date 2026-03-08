import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import SendTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/SendTeamInvitationUseCase';

const SendTeamInvitationController = createController(SendTeamInvitationUseCase, HttpStatus.Created);
export default SendTeamInvitationController;
