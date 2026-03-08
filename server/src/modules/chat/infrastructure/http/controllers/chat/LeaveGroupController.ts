import { createController } from '@shared/infrastructure/http/controllers/createController';
import { LeaveGroupUseCase } from '@modules/chat/application/use-cases/chat/LeaveGroupUseCase';

const LeaveGroupController = createController(LeaveGroupUseCase);

export default LeaveGroupController;
