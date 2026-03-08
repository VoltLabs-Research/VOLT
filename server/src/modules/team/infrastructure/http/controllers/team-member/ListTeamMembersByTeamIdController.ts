import { createController } from '@shared/infrastructure/http/controllers/createController';
import ListTeamMembersByTeamIdUseCase from '@modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase';

const ListTeamMembersByTeamIdController = createController(ListTeamMembersByTeamIdUseCase);
export default ListTeamMembersByTeamIdController;
