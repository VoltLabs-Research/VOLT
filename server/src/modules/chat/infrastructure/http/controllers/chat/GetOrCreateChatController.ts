import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetOrCreateChatUseCase } from '@modules/chat/application/use-cases/chat/GetOrCreateChatUseCase';

const GetOrCreateChatController = createController(GetOrCreateChatUseCase);
export default GetOrCreateChatController;
