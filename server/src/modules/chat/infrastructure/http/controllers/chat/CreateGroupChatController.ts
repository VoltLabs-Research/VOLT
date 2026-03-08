import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateGroupChatUseCase } from '@modules/chat/application/use-cases/chat/CreateGroupChatUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const CreateGroupChatController = createController(CreateGroupChatUseCase, HttpStatus.Created);

export default CreateGroupChatController;
