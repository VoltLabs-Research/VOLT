import { createController } from '@shared/infrastructure/http/controllers/createController';
import ListTeamRolesByTeamIdUseCase from '@modules/team/application/use-cases/team-role/ListTeamRolesByTeamIdUseCase';

const ListTeamRolesByTeamIdController = createController(ListTeamRolesByTeamIdUseCase);
export default ListTeamRolesByTeamIdController;
