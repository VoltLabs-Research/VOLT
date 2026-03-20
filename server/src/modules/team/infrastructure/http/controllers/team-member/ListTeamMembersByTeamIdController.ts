import ListTeamMembersByTeamIdUseCase from '@modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';

const ListTeamMembersByTeamIdController = createPaginatedController(ListTeamMembersByTeamIdUseCase);
export default ListTeamMembersByTeamIdController;
