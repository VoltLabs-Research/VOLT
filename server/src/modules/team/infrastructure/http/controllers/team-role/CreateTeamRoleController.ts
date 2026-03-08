import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import CreateTeamRoleUseCase from '@modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';

const CreateTeamRoleController = createController(CreateTeamRoleUseCase, HttpStatus.Created);
export default CreateTeamRoleController;
