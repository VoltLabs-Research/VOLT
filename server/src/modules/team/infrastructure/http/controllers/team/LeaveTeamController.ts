import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import LeaveTeamUseCase from '@modules/team/application/use-cases/team/LeaveTeamUseCase';

const LeaveTeamController = createController(LeaveTeamUseCase, HttpStatus.NoContent);
export default LeaveTeamController;
