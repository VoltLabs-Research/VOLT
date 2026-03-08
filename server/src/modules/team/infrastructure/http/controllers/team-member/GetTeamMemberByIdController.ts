import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/GetTeamMemberByIdUseCase';

const GetTeamMemberByIdController = createController(GetTeamMemberByIdUseCase);
export default GetTeamMemberByIdController;
