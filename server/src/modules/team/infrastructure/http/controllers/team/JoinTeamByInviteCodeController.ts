import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import JoinTeamByInviteCodeUseCase from '@modules/team/application/use-cases/team/JoinTeamByInviteCodeUseCase';

const JoinTeamByInviteCodeController = createController(JoinTeamByInviteCodeUseCase, HttpStatus.OK);
export default JoinTeamByInviteCodeController;
