import { createController } from '@shared/infrastructure/http/controllers/createController';
import LeaveTeamUseCase from '@modules/team/application/use-cases/team/LeaveTeamUseCase';

const LeaveTeamController = createController(LeaveTeamUseCase);
export default LeaveTeamController;
