import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateGroupChatUseCase } from '@modules/chat/application/use-cases/chat/CreateGroupChatUseCase';

const CreateGroupChatController = createController(CreateGroupChatUseCase);

export default CreateGroupChatController;
