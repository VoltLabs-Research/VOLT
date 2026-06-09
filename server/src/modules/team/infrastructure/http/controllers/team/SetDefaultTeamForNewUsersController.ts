import { createController } from '@shared/infrastructure/http/controllers/createController';
import SetDefaultTeamForNewUsersUseCase from '@modules/team/application/use-cases/team/SetDefaultTeamForNewUsersUseCase';

const SetDefaultTeamForNewUsersController = createController(SetDefaultTeamForNewUsersUseCase);
export default SetDefaultTeamForNewUsersController;
